import type { EffectDefinition } from "@/types/effects";
import chromaKeyShader from "./chroma-key.frag.glsl";

function hexToRgb(hex: string): [number, number, number] {
	const cleaned = hex.replace("#", "");
	const r = parseInt(cleaned.substring(0, 2), 16) / 255;
	const g = parseInt(cleaned.substring(2, 4), 16) / 255;
	const b = parseInt(cleaned.substring(4, 6), 16) / 255;
	return [r, g, b];
}

export const CHROMA_KEY_PRESETS = [
	{ id: "green-screen", name: "Green Screen", color: "#00b140" },
	{ id: "blue-screen", name: "Blue Screen", color: "#0047ab" },
	{ id: "red-screen", name: "Red Screen", color: "#ff0040" },
	{ id: "white-bg", name: "White Background", color: "#ffffff" },
	{ id: "black-bg", name: "Black Background", color: "#000000" },
];

export const chromaKeyEffectDefinition: EffectDefinition = {
	type: "chroma-key",
	name: "Chroma Key",
	keywords: ["green screen", "chroma key", "keying", "remove background", "blue screen", "transparency"],
	params: [
		{
			key: "keyColor",
			label: "Key Color",
			type: "color",
			default: "#00b140",
		},
		{
			key: "tolerance",
			label: "Tolerance",
			type: "number",
			default: 0.35,
			min: 0.0,
			max: 1.0,
			step: 0.01,
		},
		{
			key: "softness",
			label: "Edge Softness",
			type: "number",
			default: 0.08,
			min: 0.0,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "spillSuppress",
			label: "Spill Suppress",
			type: "number",
			default: 0.3,
			min: 0.0,
			max: 1.0,
			step: 0.01,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: chromaKeyShader,
				uniforms: ({ effectParams }) => {
					const keyColorRaw = effectParams["keyColor"];
					const keyColorHex = typeof keyColorRaw === "string" ? keyColorRaw : "#00b140";
					const [r, g, b] = hexToRgb(keyColorHex);

					const tolerance = typeof effectParams["tolerance"] === "number" ? effectParams["tolerance"] : 0.35;
					const softness = typeof effectParams["softness"] === "number" ? effectParams["softness"] : 0.08;
					const spillSuppress = typeof effectParams["spillSuppress"] === "number" ? effectParams["spillSuppress"] : 0.3;

					return {
						u_keyColor: [r, g, b],
						u_tolerance: tolerance,
						u_softness: softness,
						u_spillSuppress: spillSuppress,
						u_edgeShrink: 0,
					};
				},
			},
		],
	},
};
