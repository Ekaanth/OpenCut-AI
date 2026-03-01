import type { CanvasRenderer } from "../canvas-renderer";
import { getEffect } from "@/lib/effects";
import type { EffectParamValues } from "@/types/effects";
import { BaseNode } from "./base-node";
import { webglEffectRenderer } from "../webgl-effect-renderer";

const TIME_EPSILON = 1e-6;

export type EffectLayerNodeParams = {
	effectType: string;
	effectParams: EffectParamValues;
	timeOffset: number;
	duration: number;
};

function isInRange({
	time,
	timeOffset,
	duration,
}: {
	time: number;
	timeOffset: number;
	duration: number;
}): boolean {
	return (
		time >= timeOffset - TIME_EPSILON &&
		time < timeOffset + duration + TIME_EPSILON
	);
}

// snapshots whatever is currently on the canvas, applies the effect, draws it back
export class EffectLayerNode extends BaseNode<EffectLayerNodeParams> {
	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		if (
			!isInRange({
				time,
				timeOffset: this.params.timeOffset,
				duration: this.params.duration,
			})
		) {
			return;
		}

		const source = renderer.context.canvas as CanvasImageSource;

		const effectDefinition = getEffect({
			effectType: this.params.effectType,
		});

		const passes = effectDefinition.renderer.passes.map((pass) => ({
			fragmentShader: pass.fragmentShader,
			uniforms: pass.uniforms({
				effectParams: this.params.effectParams,
				width: renderer.width,
				height: renderer.height,
			}),
		}));
		const effectResult = webglEffectRenderer.applyEffect({
			source,
			width: renderer.width,
			height: renderer.height,
			passes,
		});

		renderer.context.save();
		renderer.context.clearRect(0, 0, renderer.width, renderer.height);
		renderer.context.drawImage(
			effectResult,
			0,
			0,
			renderer.width,
			renderer.height,
		);
		renderer.context.restore();
	}
}
