import type { EffectDefinition } from "@/types/effects";
import chromaticAberrationShader from "./chromatic-aberration-effect.frag.glsl";

export const chromaticAberrationEffectDefinition: EffectDefinition = {
	type: "chromatic-aberration",
	name: "Chromatic Aberration",
	keywords: ["chromatic", "aberration", "rgb", "split", "fringe", "prismatic"],
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
				fragmentShader: chromaticAberrationShader,
				uniforms: ({ effectParams, width, height }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 30) / 100,
					u_resolution: [width, height],
				}),
			},
		],
	},
};
