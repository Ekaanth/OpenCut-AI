import type { EffectDefinition } from "@/types/effects";
import posterizeShader from "./posterize.frag.glsl";

export const posterizeEffectDefinition: EffectDefinition = {
	type: "posterize",
	name: "Posterize",
	keywords: ["posterize", "poster", "levels", "reduce", "flat", "pop art"],
	params: [
		{
			key: "levels",
			label: "Levels",
			type: "number",
			default: 6,
			min: 2,
			max: 20,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: posterizeShader,
				uniforms: ({ effectParams }) => ({
					u_levels: typeof effectParams.levels === "number" ? effectParams.levels : 6,
				}),
			},
		],
	},
};
