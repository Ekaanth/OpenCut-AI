import type { EffectDefinition } from "@/types/effects";
import filmGrainShader from "./film-grain.frag.glsl";

export const filmGrainEffectDefinition: EffectDefinition = {
	type: "film-grain",
	name: "Film Grain",
	keywords: ["grain", "film", "noise", "texture", "vintage", "cinematic"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 20,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: filmGrainShader,
				uniforms: ({ effectParams }) => ({
					u_intensity: (typeof effectParams.intensity === "number" ? effectParams.intensity : 20) / 100,
					u_time: performance.now() / 1000.0,
				}),
			},
		],
	},
};
