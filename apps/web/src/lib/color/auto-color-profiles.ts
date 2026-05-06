export interface ColorCorrectionProfile {
	name: string;
	description: string;
	adjustments: {
		brightness: number;
		contrast: number;
		saturation: number;
		temperature: number;
		tint: number;
		highlights: number;
		shadows: number;
		exposure: number;
		gamma: number;
	};
}

export const AUTO_CORRECT_PROFILES: ColorCorrectionProfile[] = [
	{
		name: "Auto Balance",
		description: "Neutral white balance and exposure",
		adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, exposure: 0, gamma: 0 },
	},
	{
		name: "Vibrant Pop",
		description: "Boosted saturation and contrast",
		adjustments: { brightness: 5, contrast: 15, saturation: 25, temperature: 5, tint: 0, highlights: -10, shadows: 10, exposure: 5, gamma: 0 },
	},
	{
		name: "Film Look",
		description: "Cinematic color grading",
		adjustments: { brightness: -5, contrast: 10, saturation: -15, temperature: -10, tint: 5, highlights: -20, shadows: 15, exposure: -5, gamma: 5 },
	},
	{
		name: "Warm Sunset",
		description: "Warm, golden tones",
		adjustments: { brightness: 5, contrast: 5, saturation: 10, temperature: 25, tint: 5, highlights: 5, shadows: 10, exposure: 5, gamma: 0 },
	},
	{
		name: "Cool Blue",
		description: "Cool, blue tones",
		adjustments: { brightness: 0, contrast: 10, saturation: -10, temperature: -20, tint: -5, highlights: 5, shadows: -5, exposure: 0, gamma: 0 },
	},
	{
		name: "High Contrast B&W",
		description: "Dramatic black and white",
		adjustments: { brightness: 5, contrast: 30, saturation: -100, temperature: 0, tint: 0, highlights: 10, shadows: -20, exposure: 5, gamma: 10 },
	},
	{
		name: "Soft Portrait",
		description: "Soft, flattering skin tones",
		adjustments: { brightness: 10, contrast: -5, saturation: 5, temperature: 10, tint: 5, highlights: -10, shadows: 15, exposure: 5, gamma: -5 },
	},
	{
		name: "Night Vision",
		description: "Enhanced low-light footage",
		adjustments: { brightness: 20, contrast: 15, saturation: -20, temperature: -15, tint: 10, highlights: -30, shadows: 40, exposure: 20, gamma: -10 },
	},
];
