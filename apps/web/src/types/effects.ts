export interface Effect {
	id: string;
	type: string;
	params: EffectParamValues;
	enabled: boolean;
}

export type EffectParamType = "number" | "boolean" | "select" | "color";

export type EffectParamValues = Record<string, number | string | boolean>;

export interface EffectParamDefinition {
	key: string;
	label: string;
	type: EffectParamType;
	default: number | string | boolean;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: string; label: string }>;
}

export interface WebGLEffectPass {
	fragmentShader: string;
	uniforms(params: {
		effectParams: EffectParamValues;
		width: number;
		height: number;
	}): Record<string, number | number[]>;
}

export interface WebGLEffectRenderer {
	type: "webgl";
	passes: WebGLEffectPass[];
}

export type EffectRenderer = WebGLEffectRenderer;

export interface EffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: EffectParamDefinition[];
	renderer: EffectRenderer;
}
