import type { EffectDefinition } from "@/types/effects";
import motionBlurShader from "./motion-blur.frag.glsl";

export const motionBlurEffectDefinition: EffectDefinition = {
	type: "motion-blur",
	name: "Motion Blur",
	keywords: ["motion", "blur", "speed", "movement", "trail", "smear"],
	params: [
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 30,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: motionBlurShader,
				uniforms: ({ effectParams, width, height }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 30) / 100,
					u_resolution: [width, height],
				}),
			},
		],
	},
};
