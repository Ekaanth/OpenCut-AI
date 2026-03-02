import type { EffectDefinition } from "@/types/effects";
import blurFragmentShader from "./blur.frag.glsl";

export const blurEffectDefinition: EffectDefinition = {
	type: "blur",
	name: "Blur",
	keywords: ["blur", "soft", "defocus"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 15,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
		{
			fragmentShader: blurFragmentShader,
			uniforms: ({ effectParams, width }) => {
				const intensity =
					typeof effectParams.intensity === "number"
						? effectParams.intensity
						: Number.parseFloat(String(effectParams.intensity));
				return {
					u_sigma: Math.max((intensity / 5) * (width / 1920), 0.001),
					u_direction: [1, 0],
				};
			},
		},
		{
			fragmentShader: blurFragmentShader,
			uniforms: ({ effectParams, height }) => {
				const intensity =
					typeof effectParams.intensity === "number"
						? effectParams.intensity
						: Number.parseFloat(String(effectParams.intensity));
				return {
					u_sigma: Math.max((intensity / 5) * (height / 1080), 0.001),
					u_direction: [0, 1],
				};
			},
		},
		],
	},
};
