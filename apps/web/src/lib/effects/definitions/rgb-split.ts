import type { EffectDefinition } from "@/types/effects";
import rgbSplitShader from "./rgb-split.frag.glsl";

export const rgbSplitEffectDefinition: EffectDefinition = {
	type: "rgb-split",
	name: "RGB Split",
	keywords: ["rgb", "split", "separate", "channel", "offset", "anaglyph"],
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
				fragmentShader: rgbSplitShader,
				uniforms: ({ effectParams, width, height }) => ({
					u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 30) / 100,
					u_resolution: [width, height],
				}),
			},
		],
	},
};
