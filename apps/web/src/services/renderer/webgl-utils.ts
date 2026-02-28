import VERTEX_SHADER_SOURCE from "@/lib/effects/effect.vert.glsl";

export interface EffectPassData {
	fragmentShader: string;
	uniforms: Record<string, number | number[]>;
}

export const QUAD_POSITIONS = new Float32Array([
	-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
]);

export function compileProgram({
	context,
	fragmentShaderSource,
	programCache,
}: {
	context: WebGLRenderingContext;
	fragmentShaderSource: string;
	programCache: Map<string, WebGLProgram>;
}): WebGLProgram {
	const cached = programCache.get(fragmentShaderSource);
	if (cached) {
		return cached;
	}
	const vertexShader = compileShader({
		context,
		source: VERTEX_SHADER_SOURCE,
		type: context.VERTEX_SHADER,
	});
	const fragmentShader = compileShader({
		context,
		source: fragmentShaderSource,
		type: context.FRAGMENT_SHADER,
	});
	const program = context.createProgram();
	if (!program) {
		throw new Error("Failed to create WebGL program");
	}
	context.attachShader(program, vertexShader);
	context.attachShader(program, fragmentShader);
	context.linkProgram(program);
	if (!context.getProgramParameter(program, context.LINK_STATUS)) {
		const info = context.getProgramInfoLog(program);
		context.deleteProgram(program);
		throw new Error(`WebGL program link failed: ${info}`);
	}
	context.deleteShader(vertexShader);
	context.deleteShader(fragmentShader);
	programCache.set(fragmentShaderSource, program);
	return program;
}

export function compileShader({
	context,
	source,
	type,
}: {
	context: WebGLRenderingContext;
	source: string;
	type: number;
}): WebGLShader {
	const shader = context.createShader(type);
	if (!shader) {
		throw new Error("Failed to create WebGL shader");
	}
	context.shaderSource(shader, source);
	context.compileShader(shader);
	if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
		const info = context.getShaderInfoLog(shader);
		context.deleteShader(shader);
		throw new Error(`WebGL shader compile failed: ${info}`);
	}
	return shader;
}

export function createTexture({
	context,
	source,
}: {
	context: WebGLRenderingContext;
	source: CanvasImageSource;
}): WebGLTexture {
	const texture = context.createTexture();
	if (!texture) {
		throw new Error("Failed to create WebGL texture");
	}
	context.activeTexture(context.TEXTURE0);
	context.bindTexture(context.TEXTURE_2D, texture);
	context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, 1);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_S,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_T,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MIN_FILTER,
		context.LINEAR,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MAG_FILTER,
		context.LINEAR,
	);
	context.texImage2D(
		context.TEXTURE_2D,
		0,
		context.RGBA,
		context.RGBA,
		context.UNSIGNED_BYTE,
		source as TexImageSource,
	);
	return texture;
}

export function setUniforms({
	context,
	program,
	uniforms,
}: {
	context: WebGLRenderingContext;
	program: WebGLProgram;
	uniforms: Record<string, number | number[]>;
}): void {
	for (const [name, value] of Object.entries(uniforms)) {
		const location = context.getUniformLocation(program, name);
		if (location === null) continue;

		if (typeof value === "number") {
			context.uniform1f(location, value);
		} else if (Array.isArray(value)) {
			if (value.length === 2) {
				context.uniform2fv(location, new Float32Array(value));
			} else if (value.length === 3) {
				context.uniform3fv(location, new Float32Array(value));
			} else if (value.length === 4) {
				context.uniform4fv(location, new Float32Array(value));
			}
		}
	}
}

export function drawFullscreenQuad({
	context,
	program,
	width,
	height,
}: {
	context: WebGLRenderingContext;
	program: WebGLProgram;
	width: number;
	height: number;
}): void {
	const positionLocation = context.getAttribLocation(program, "a_position");
	const buffer = context.createBuffer();
	context.bindBuffer(context.ARRAY_BUFFER, buffer);
	context.bufferData(context.ARRAY_BUFFER, QUAD_POSITIONS, context.STATIC_DRAW);
	context.enableVertexAttribArray(positionLocation);
	context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

	context.viewport(0, 0, width, height);
	context.clearColor(0, 0, 0, 0);
	context.clear(context.COLOR_BUFFER_BIT);
	context.drawArrays(context.TRIANGLES, 0, 6);
}

export function createFramebufferTexture({
	context,
	width,
	height,
}: {
	context: WebGLRenderingContext;
	width: number;
	height: number;
}): { texture: WebGLTexture; framebuffer: WebGLFramebuffer } {
	const texture = context.createTexture();
	if (!texture) throw new Error("Failed to create framebuffer texture");
	context.bindTexture(context.TEXTURE_2D, texture);
	context.texImage2D(
		context.TEXTURE_2D,
		0,
		context.RGBA,
		width,
		height,
		0,
		context.RGBA,
		context.UNSIGNED_BYTE,
		null,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_S,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_WRAP_T,
		context.CLAMP_TO_EDGE,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MIN_FILTER,
		context.LINEAR,
	);
	context.texParameteri(
		context.TEXTURE_2D,
		context.TEXTURE_MAG_FILTER,
		context.LINEAR,
	);
	context.bindTexture(context.TEXTURE_2D, null);

	const framebuffer = context.createFramebuffer();
	if (!framebuffer) throw new Error("Failed to create framebuffer");
	context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
	context.framebufferTexture2D(
		context.FRAMEBUFFER,
		context.COLOR_ATTACHMENT0,
		context.TEXTURE_2D,
		texture,
		0,
	);
	context.bindFramebuffer(context.FRAMEBUFFER, null);

	return { texture, framebuffer };
}

export function applyMultiPassEffect({
	context,
	source,
	width,
	height,
	passes,
	programCache,
}: {
	context: WebGLRenderingContext;
	source: CanvasImageSource;
	width: number;
	height: number;
	passes: EffectPassData[];
	programCache: Map<string, WebGLProgram>;
}): void {
	const sourceTexture = createTexture({ context, source });
	let currentTexture: WebGLTexture = sourceTexture;

	const intermediates: Array<{
		texture: WebGLTexture;
		framebuffer: WebGLFramebuffer;
	}> = [];
	for (let i = 0; i < passes.length - 1; i++) {
		intermediates.push(createFramebufferTexture({ context, width, height }));
	}

	for (let i = 0; i < passes.length; i++) {
		const pass = passes[i];
		const program = compileProgram({
			context,
			fragmentShaderSource: pass.fragmentShader,
			programCache,
		});
		const isLastPass = i === passes.length - 1;
		const targetFramebuffer = isLastPass ? null : intermediates[i].framebuffer;

		context.bindFramebuffer(context.FRAMEBUFFER, targetFramebuffer);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook
		context.useProgram(program);
		context.activeTexture(context.TEXTURE0);
		context.bindTexture(context.TEXTURE_2D, currentTexture);

		const uTextureLocation = context.getUniformLocation(program, "u_texture");
		if (uTextureLocation) {
			context.uniform1i(uTextureLocation, 0);
		}

		setUniforms({
			context,
			program,
			uniforms: { ...pass.uniforms, u_resolution: [width, height] },
		});
		drawFullscreenQuad({ context, program, width, height });

		if (!isLastPass) {
			currentTexture = intermediates[i].texture;
		}
	}

	context.deleteTexture(sourceTexture);
	for (const intermediate of intermediates) {
		context.deleteTexture(intermediate.texture);
		context.deleteFramebuffer(intermediate.framebuffer);
	}
	context.bindTexture(context.TEXTURE_2D, null);
	context.bindFramebuffer(context.FRAMEBUFFER, null);
}
