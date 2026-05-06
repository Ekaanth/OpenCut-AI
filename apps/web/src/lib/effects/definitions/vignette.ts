import type { EffectDefinition } from "@/types/effects";
import vignetteShader from "./vignette.frag.glsl";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vignette",
	keywords: ["vignette", "dark", "edges", "corner", "focus"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: vignetteShader,
				uniforms: ({ effectParams }) => ({
					u_intensity: (typeof effectParams.intensity === "number" ? effectParams.intensity : 50) / 100,
				}),
			},
		],
	},
};
