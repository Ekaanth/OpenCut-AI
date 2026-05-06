import type { EffectDefinition } from "@/types/effects";
import lensDistortionShader from "./lens-distortion.frag.glsl";

export const lensDistortionEffectDefinition: EffectDefinition = {
	type: "lens-distortion",
	name: "Lens Distortion",
	keywords: ["lens", "distortion", "barrel", "pincushion", "fisheye", "warp"],
	params: [
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 30,
			min: -100,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: lensDistortionShader,
				uniforms: ({ effectParams }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 30) / 100,
				}),
			},
		],
	},
};
