import type { EffectDefinition } from "@/types/effects";
import colorAdjustShader from "./color-adjust.frag.glsl";

function getParam(effectParams: Record<string, unknown>, key: string, fallback: number): number {
	const val = effectParams[key];
	return typeof val === "number" ? val : fallback;
}

export const colorAdjustEffectDefinition: EffectDefinition = {
	type: "color-adjust",
	name: "Color Adjust",
	keywords: ["color", "brightness", "contrast", "saturation", "temperature", "adjust"],
	params: [
		{
			key: "brightness",
			label: "Brightness",
			type: "number",
			default: 0,
			min: -0.5,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "contrast",
			label: "Contrast",
			type: "number",
			default: 1,
			min: 0.2,
			max: 3,
			step: 0.01,
		},
		{
			key: "saturation",
			label: "Saturation",
			type: "number",
			default: 1,
			min: 0,
			max: 3,
			step: 0.01,
		},
		{
			key: "temperature",
			label: "Temperature",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "vignette",
			label: "Vignette",
			type: "number",
			default: 0,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: colorAdjustShader,
				uniforms: ({ effectParams }) => ({
					u_brightness: getParam(effectParams, "brightness", 0),
					u_contrast: getParam(effectParams, "contrast", 1),
					u_saturation: getParam(effectParams, "saturation", 1),
					u_temperature: getParam(effectParams, "temperature", 0),
					u_vignette: getParam(effectParams, "vignette", 0),
				}),
			},
		],
	},
};

/**
 * Filter presets — pre-configured color-adjust parameter sets.
 */
export interface FilterPreset {
	id: string;
	name: string;
	params: Record<string, number>;
}

export const FILTER_PRESETS: FilterPreset[] = [
	{
		id: "grayscale",
		name: "Grayscale",
		params: { brightness: 0, contrast: 1, saturation: 0, temperature: 0, vignette: 0 },
	},
	{
		id: "sepia",
		name: "Sepia",
		params: { brightness: 0.05, contrast: 0.95, saturation: 0.3, temperature: 0.6, vignette: 0.2 },
	},
	{
		id: "vintage",
		name: "Vintage",
		params: { brightness: -0.05, contrast: 1.15, saturation: 0.6, temperature: 0.3, vignette: 0.5 },
	},
	{
		id: "warm",
		name: "Warm",
		params: { brightness: 0.03, contrast: 1.05, saturation: 1.1, temperature: 0.5, vignette: 0 },
	},
	{
		id: "cool",
		name: "Cool",
		params: { brightness: 0, contrast: 1.05, saturation: 0.9, temperature: -0.5, vignette: 0 },
	},
	{
		id: "vivid",
		name: "Vivid",
		params: { brightness: 0.02, contrast: 1.3, saturation: 1.8, temperature: 0, vignette: 0 },
	},
	{
		id: "muted",
		name: "Muted",
		params: { brightness: 0.05, contrast: 0.85, saturation: 0.5, temperature: 0, vignette: 0 },
	},
	{
		id: "dramatic",
		name: "Dramatic",
		params: { brightness: -0.08, contrast: 1.5, saturation: 0.7, temperature: -0.2, vignette: 0.6 },
	},
	{
		id: "high-key",
		name: "High Key",
		params: { brightness: 0.2, contrast: 0.8, saturation: 0.8, temperature: 0.1, vignette: 0 },
	},
	{
		id: "low-key",
		name: "Low Key",
		params: { brightness: -0.15, contrast: 1.4, saturation: 0.6, temperature: -0.1, vignette: 0.4 },
	},
	{
		id: "noir",
		name: "Noir",
		params: { brightness: -0.1, contrast: 1.6, saturation: 0, temperature: 0, vignette: 0.7 },
	},
	{
		id: "golden",
		name: "Golden Hour",
		params: { brightness: 0.05, contrast: 1.1, saturation: 1.2, temperature: 0.7, vignette: 0.3 },
	},
	{
		id: "sunset-glow",
		name: "Sunset Glow",
		params: { brightness: 0.08, contrast: 1.15, saturation: 1.3, temperature: 0.8, vignette: 0.25 },
	},
	{
		id: "moonlight",
		name: "Moonlight",
		params: { brightness: -0.1, contrast: 1.2, saturation: 0.3, temperature: -0.7, vignette: 0.5 },
	},
	{
		id: "cyberpunk",
		name: "Cyberpunk",
		params: { brightness: -0.05, contrast: 1.6, saturation: 1.5, temperature: -0.6, vignette: 0.4 },
	},
	{
		id: "film-noir-bw",
		name: "Film Noir B&W",
		params: { brightness: -0.15, contrast: 1.8, saturation: 0, temperature: 0, vignette: 0.8 },
	},
	{
		id: "dreamy",
		name: "Dreamy",
		params: { brightness: 0.15, contrast: 0.75, saturation: 0.7, temperature: 0.2, vignette: 0.15 },
	},
	{
		id: "retro-vhs",
		name: "Retro VHS",
		params: { brightness: 0.05, contrast: 1.3, saturation: 1.4, temperature: 0.4, vignette: 0.1 },
	},
	{
		id: "cinematic-teal-orange",
		name: "Teal & Orange",
		params: { brightness: -0.03, contrast: 1.25, saturation: 1.1, temperature: 0.35, vignette: 0.3 },
	},
	{
		id: "bleach-bypass",
		name: "Bleach Bypass",
		params: { brightness: -0.05, contrast: 1.7, saturation: 0.35, temperature: 0.1, vignette: 0.35 },
	},
	{
		id: "cross-process",
		name: "Cross Process",
		params: { brightness: 0.1, contrast: 1.2, saturation: 1.6, temperature: -0.3, vignette: 0.2 },
	},
	{
		id: "faded-film",
		name: "Faded Film",
		params: { brightness: 0.12, contrast: 0.9, saturation: 0.55, temperature: 0.15, vignette: 0.3 },
	},
];
