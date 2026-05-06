import type { EffectDefinition } from "@/types/effects";
import glitchShader from "./glitch-effect.frag.glsl";

export const glitchEffectDefinition: EffectDefinition = {
	type: "glitch",
	name: "Glitch",
	keywords: ["glitch", "digital", "error", "corrupt", "pixel", "distortion"],
	params: [
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 40,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: glitchShader,
				uniforms: ({ effectParams, width, height }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 40) / 100,
					u_resolution: [width, height],
				}),
			},
		],
	},
};
