export interface ThumbnailGenParams {
	prompt: string;
	style: "cinematic" | "bold-text" | "minimal" | "gradient" | "collage";
	width: number;
	height: number;
	includeText: boolean;
	headline: string;
	colorScheme: "vibrant" | "dark" | "warm" | "cool" | "mono";
}

export interface ThumbnailGenResult {
	imageUrl: string;
	seed: number;
	width: number;
	height: number;
}

export const THUMBNAIL_STYLES = [
	{ value: "cinematic", label: "Cinematic", desc: "Dramatic lighting, film grain" },
	{ value: "bold-text", label: "Bold Text", desc: "Large text, high contrast" },
	{ value: "minimal", label: "Minimal", desc: "Clean, simple, lots of space" },
	{ value: "gradient", label: "Gradient", desc: "Colorful gradient backgrounds" },
	{ value: "collage", label: "Collage", desc: "Multi-image layout" },
] as const;

export const THUMBNAIL_SIZES = [
	{ width: 1280, height: 720, label: "YouTube (16:9)" },
	{ width: 1080, height: 1920, label: "TikTok (9:16)" },
	{ width: 1080, height: 1080, label: "Instagram (1:1)" },
	{ width: 1080, height: 1350, label: "Instagram (4:5)" },
] as const;

export const COLOR_SCHEMES = [
	{ value: "vibrant", label: "Vibrant" },
	{ value: "dark", label: "Dark" },
	{ value: "warm", label: "Warm" },
	{ value: "cool", label: "Cool" },
	{ value: "mono", label: "Mono" },
] as const;

export const DEFAULT_THUMBNAIL_PARAMS: ThumbnailGenParams = {
	prompt: "",
	style: "cinematic",
	width: 1280,
	height: 720,
	includeText: true,
	headline: "",
	colorScheme: "vibrant",
};
