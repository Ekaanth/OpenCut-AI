import type { CanvasRenderer } from "../canvas-renderer";
import { createOffscreenCanvas } from "../canvas-utils";
import { BaseNode } from "./base-node";
import type { Transform, TransitionData } from "@/types/timeline";
import type { Effect } from "@/types/effects";
import type { BlendMode } from "@/types/rendering";
import type { ElementAnimations } from "@/types/animation";
import {
	resolveOpacityAtTime,
	resolveTransformAtTime,
	getElementLocalTime,
} from "@/lib/animation";
import { renderTransition } from "../transition-renderer";
import { getTransition } from "@/lib/transitions";

export interface TransitionSourceParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	playbackRate?: number;
	transform: Transform;
	animations?: ElementAnimations;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export interface TransitionNodeParams {
	transitionType: string;
	transitionDuration: number;
	cutTime: number;
	sourceA: TransitionSourceParams;
	sourceB: TransitionSourceParams;
	mediaMap: Map<string, { url: string; file?: File }>;
	mediaIdA?: string;
	mediaIdB?: string;
}

export class TransitionNode extends BaseNode<TransitionNodeParams> {
	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const { transitionType, transitionDuration, cutTime } = this.params;
		const halfDuration = transitionDuration / 2;
		const transitionStart = cutTime - halfDuration;
		const transitionEnd = cutTime + halfDuration;

		if (time < transitionStart || time >= transitionEnd) return;

		const progress = (time - transitionStart) / transitionDuration;

		const canvasA = this.renderSourceFrame({
			renderer,
			sourceParams: this.params.sourceA,
			time,
		});
		const canvasB = this.renderSourceFrame({
			renderer,
			sourceParams: this.params.sourceB,
			time,
		});

		if (!canvasA || !canvasB) return;

		const definition = getTransition({ transitionType });

		const result = renderTransition({
			sourceA: canvasA,
			sourceB: canvasB,
			width: renderer.width,
			height: renderer.height,
			progress,
			fragmentShader: definition.fragmentShader,
		});

		renderer.context.save();
		renderer.context.globalCompositeOperation = "source-over";
		renderer.context.drawImage(result as CanvasImageSource, 0, 0);
		renderer.context.restore();
	}

	private renderSourceFrame({
		renderer,
		sourceParams,
		time,
	}: {
		renderer: CanvasRenderer;
		sourceParams: TransitionSourceParams;
		time: number;
	}): HTMLCanvasElement | OffscreenCanvas | null {
		const offscreen = createOffscreenCanvas({
			width: renderer.width,
			height: renderer.height,
		});
		const ctx = offscreen.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return null;

		const animLocalTime = getElementLocalTime({
			timelineTime: time,
			elementStartTime: sourceParams.timeOffset,
			elementDuration: sourceParams.duration,
		});

		const transform = resolveTransformAtTime({
			baseTransform: sourceParams.transform,
			animations: sourceParams.animations,
			localTime: animLocalTime,
		});
		const opacity = resolveOpacityAtTime({
			baseOpacity: sourceParams.opacity,
			animations: sourceParams.animations,
			localTime: animLocalTime,
		});

		(ctx as CanvasRenderingContext2D).globalAlpha = opacity;

		return offscreen;
	}
}
