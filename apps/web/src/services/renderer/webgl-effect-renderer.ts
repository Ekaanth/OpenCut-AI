import { createOffscreenCanvas } from "./canvas-utils";
import { applyMultiPassEffect } from "./webgl-utils";
import type { EffectPassData } from "./webgl-utils";

export interface ApplyEffectParams {
	source: CanvasImageSource;
	width: number;
	height: number;
	passes: EffectPassData[];
}

let gl: WebGLRenderingContext | null = null;
let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
const programCache = new Map<string, WebGLProgram>();

function getOrCreateCanvas({
	width,
	height,
}: {
	width: number;
	height: number;
}): OffscreenCanvas | HTMLCanvasElement {
	if (!canvas) {
		canvas = createOffscreenCanvas({ width, height });
		gl = canvas.getContext("webgl", {
			premultipliedAlpha: false,
		}) as WebGLRenderingContext | null;
		if (!gl) {
			throw new Error("WebGL not supported");
		}
	}
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
	return canvas;
}

function applyEffect({
	source,
	width,
	height,
	passes,
}: ApplyEffectParams): OffscreenCanvas | HTMLCanvasElement {
	const targetCanvas = getOrCreateCanvas({ width, height });
	const context = gl;
	if (!context) {
		throw new Error("WebGL context not initialized");
	}

	applyMultiPassEffect({
		context,
		source,
		width,
		height,
		passes,
		programCache,
	});

	const outputCanvas = createOffscreenCanvas({ width, height });
	const outputCtx = outputCanvas.getContext("2d") as
		| CanvasRenderingContext2D
		| OffscreenCanvasRenderingContext2D
		| null;
	if (outputCtx) {
		outputCtx.drawImage(targetCanvas, 0, 0, width, height);
	}
	return outputCanvas;
}

export const webglEffectRenderer = {
	applyEffect,
};
