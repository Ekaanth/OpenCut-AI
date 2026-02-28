import type { CanvasRenderer } from "../canvas-renderer";
import { createOffscreenCanvas } from "../canvas-utils";
import { BaseNode } from "./base-node";
import type { Effect } from "@/types/effects";
import type { BlendMode } from "@/types/rendering";
import type { Transform } from "@/types/timeline";
import type { ElementAnimations } from "@/types/animation";
import {
	getElementLocalTime,
	resolveOpacityAtTime,
	resolveTransformAtTime,
} from "@/lib/animation";
import { TIME_EPSILON_SECONDS } from "@/constants/animation-constants";
import { getEffect } from "@/lib/effects";
import { webglEffectRenderer } from "../webgl-effect-renderer";

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	animations?: ElementAnimations;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
	protected getSourceLocalTime({ time }: { time: number }): number {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	protected getAnimationLocalTime({ time }: { time: number }): number {
		return getElementLocalTime({
			timelineTime: time,
			elementStartTime: this.params.timeOffset,
			elementDuration: this.params.duration,
		});
	}

	protected isInRange({ time }: { time: number }): boolean {
		const localTime = this.getSourceLocalTime({ time });
		return (
			localTime >= this.params.trimStart - TIME_EPSILON_SECONDS &&
			localTime < this.params.trimStart + this.params.duration
		);
	}

	protected renderVisual({
		renderer,
		source,
		sourceWidth,
		sourceHeight,
		timelineTime,
	}: {
		renderer: CanvasRenderer;
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
		timelineTime: number;
	}): void {
		renderer.context.save();

		const animationLocalTime = this.getAnimationLocalTime({ time: timelineTime });
		const transform = resolveTransformAtTime({
			baseTransform: this.params.transform,
			animations: this.params.animations,
			localTime: animationLocalTime,
		});
		const opacity = resolveOpacityAtTime({
			baseOpacity: this.params.opacity,
			animations: this.params.animations,
			localTime: animationLocalTime,
		});
		const containScale = Math.min(
			renderer.width / sourceWidth,
			renderer.height / sourceHeight,
		);
		const scaledWidth = sourceWidth * containScale * transform.scale;
		const scaledHeight = sourceHeight * containScale * transform.scale;
		const x = renderer.width / 2 + transform.position.x - scaledWidth / 2;
		const y = renderer.height / 2 + transform.position.y - scaledHeight / 2;

		renderer.context.globalCompositeOperation = (
			this.params.blendMode && this.params.blendMode !== "normal"
				? this.params.blendMode
				: "source-over"
		) as GlobalCompositeOperation;
		renderer.context.globalAlpha = opacity;

		if (transform.rotate !== 0) {
			const centerX = x + scaledWidth / 2;
			const centerY = y + scaledHeight / 2;
			renderer.context.translate(centerX, centerY);
			renderer.context.rotate((transform.rotate * Math.PI) / 180);
			renderer.context.translate(-centerX, -centerY);
		}

		const enabledEffects =
			this.params.effects?.filter((effect) => effect.enabled) ?? [];

		if (enabledEffects.length === 0) {
			renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);
			renderer.context.restore();
			return;
		}

		const elementCanvas = createOffscreenCanvas({
			width: Math.round(scaledWidth),
			height: Math.round(scaledHeight),
		});
		const elementCtx = elementCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!elementCtx) {
			renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);
			renderer.context.restore();
			return;
		}

		elementCtx.drawImage(source, 0, 0, scaledWidth, scaledHeight);

		let currentResult: CanvasImageSource = elementCanvas;

		for (const effect of enabledEffects) {
			const definition = getEffect({ effectType: effect.type });
			const passes = definition.renderer.passes.map((pass) => ({
				fragmentShader: pass.fragmentShader,
				uniforms: pass.uniforms({
					effectParams: effect.params,
					width: scaledWidth,
					height: scaledHeight,
				}),
			}));
			currentResult = webglEffectRenderer.applyEffect({
				source: currentResult,
				width: Math.round(scaledWidth),
				height: Math.round(scaledHeight),
				passes,
			});
		}

		renderer.context.drawImage(
			currentResult,
			x,
			y,
			scaledWidth,
			scaledHeight,
		);
		renderer.context.restore();
	}
}
