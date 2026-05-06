import type { EffectDefinition } from "@/types/effects";
import sharpenShader from "./sharpen.frag.glsl";

export const sharpenEffectDefinition: EffectDefinition = {
	type: "sharpen",
	name: "Sharpen",
	keywords: ["sharpen", "detail", "crisp", "enhance"],
	params: [
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 25,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: sharpenShader,
				uniforms: ({ effectParams, width, height }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 25) / 100,
					u_resolution: [width, height],
				}),
			},
		],
	},
};
