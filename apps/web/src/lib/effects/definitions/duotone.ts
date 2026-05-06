import type { EffectDefinition } from "@/types/effects";
import duotoneShader from "./duotone.frag.glsl";

export const duotoneEffectDefinition: EffectDefinition = {
	type: "duotone",
	name: "Duotone",
	keywords: ["duotone", "two tone", "monochrome", "tint", "colorize"],
	params: [
		{
			key: "color1",
			label: "Shadow Color",
			type: "color",
			default: "#000022",
		},
		{
			key: "color2",
			label: "Highlight Color",
			type: "color",
			default: "#ff6600",
		},
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 80,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: duotoneShader,
				uniforms: ({ effectParams }) => {
					const hex1 = typeof effectParams.color1 === "string" ? effectParams.color1 : "#000022";
					const hex2 = typeof effectParams.color2 === "string" ? effectParams.color2 : "#ff6600";
					const parseHex = (hex: string) => {
						const h = hex.replace("#", "");
						return [
							parseInt(h.substring(0, 2), 16) / 255,
							parseInt(h.substring(2, 4), 16) / 255,
							parseInt(h.substring(4, 6), 16) / 255,
						];
					};
					return {
						u_color1: parseHex(hex1),
						u_color2: parseHex(hex2),
						u_amount: (typeof effectParams.amount === "number" ? effectParams.amount : 80) / 100,
					};
				},
			},
		],
	},
};
