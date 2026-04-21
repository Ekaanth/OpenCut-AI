import { createOffscreenCanvas } from "./canvas-utils";
import { createTexture, drawFullscreenQuad, setUniforms } from "./webgl-utils";
import VERTEX_SHADER_SOURCE from "@/lib/transitions/transition.vert.glsl";

let gl: WebGLRenderingContext | null = null;
let transitionCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

function getOrCreateContext(
	width: number,
	height: number,
): WebGLRenderingContext {
	if (
		!transitionCanvas ||
		(transitionCanvas as HTMLCanvasElement).width !== width ||
		(transitionCanvas as HTMLCanvasElement).height !== height
	) {
		transitionCanvas = createOffscreenCanvas({ width, height });
		const ctx = (transitionCanvas as HTMLCanvasElement).getContext("webgl", {
			premultipliedAlpha: false,
		}) as WebGLRenderingContext | null;
		if (!ctx) throw new Error("WebGL not supported for transitions");
		gl = ctx;
	}
	return gl!;
}

function compileShader(
	context: WebGLRenderingContext,
	source: string,
	type: number,
): WebGLShader {
	const shader = context.createShader(type);
	if (!shader) throw new Error("Failed to create shader");
	context.shaderSource(shader, source);
	context.compileShader(shader);
	if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
		const info = context.getShaderInfoLog(shader);
		context.deleteShader(shader);
		throw new Error(`Shader compile failed: ${info}`);
	}
	return shader;
}

export function renderTransition({
	sourceA,
	sourceB,
	width,
	height,
	progress,
	fragmentShader,
}: {
	sourceA: CanvasImageSource;
	sourceB: CanvasImageSource;
	width: number;
	height: number;
	progress: number;
	fragmentShader: string;
}): HTMLCanvasElement | OffscreenCanvas {
	const context = getOrCreateContext(width, height);

	const vertShader = compileShader(
		context,
		VERTEX_SHADER_SOURCE,
		context.VERTEX_SHADER,
	);
	const fragShader = compileShader(
		context,
		fragmentShader,
		context.FRAGMENT_SHADER,
	);

	const program = context.createProgram();
	if (!program) throw new Error("Failed to create transition program");
	context.attachShader(program, vertShader);
	context.attachShader(program, fragShader);
	context.linkProgram(program);

	if (!context.getProgramParameter(program, context.LINK_STATUS)) {
		const info = context.getProgramInfoLog(program);
		context.deleteProgram(program);
		throw new Error(`Transition program link failed: ${info}`);
	}
	context.deleteShader(vertShader);
	context.deleteShader(fragShader);

	const textureA = createTexture({ context, source: sourceA });
	const textureB = createTexture({ context, source: sourceB });

	context.bindFramebuffer(context.FRAMEBUFFER, null);
	context.useProgram(program);

	context.activeTexture(context.TEXTURE0);
	context.bindTexture(context.TEXTURE_2D, textureA);
	const uALoc = context.getUniformLocation(program, "u_textureA");
	if (uALoc) context.uniform1i(uALoc, 0);

	context.activeTexture(context.TEXTURE1);
	context.bindTexture(context.TEXTURE_2D, textureB);
	const uBLoc = context.getUniformLocation(program, "u_textureB");
	if (uBLoc) context.uniform1i(uBLoc, 1);

	setUniforms({
		context,
		program,
		uniforms: {
			u_progress: Math.max(0, Math.min(1, progress)),
			u_resolution: [width, height],
		},
	});

	drawFullscreenQuad({ context, program, width, height });

	context.deleteTexture(textureA);
	context.deleteTexture(textureB);
	context.useProgram(null);

	const outputCanvas = createOffscreenCanvas({ width, height });
	const outputCtx = outputCanvas.getContext("2d") as
		| CanvasRenderingContext2D
		| OffscreenCanvasRenderingContext2D
		| null;
	if (outputCtx) {
		outputCtx.drawImage(
			transitionCanvas as CanvasImageSource,
			0,
			0,
			width,
			height,
		);
	}
	return outputCanvas;
}
