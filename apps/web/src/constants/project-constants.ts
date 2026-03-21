import type { TCanvasSize } from "@/types/project";

export const DEFAULT_CANVAS_PRESETS: TCanvasSize[] = [
	{ width: 1920, height: 1080 },
	{ width: 1080, height: 1920 },
	{ width: 1080, height: 1080 },
	{ width: 1440, height: 1080 },
];

export interface FramePreset {
	id: string;
	label: string;
	shortLabel: string;
	canvas: TCanvasSize;
	ratio: string;
}

export const FRAME_PRESETS: FramePreset[] = [
	{
		id: "landscape",
		label: "YouTube / Landscape",
		shortLabel: "16:9",
		canvas: { width: 1920, height: 1080 },
		ratio: "16:9",
	},
	{
		id: "portrait",
		label: "TikTok / Reels / Shorts",
		shortLabel: "9:16",
		canvas: { width: 1080, height: 1920 },
		ratio: "9:16",
	},
	{
		id: "square",
		label: "Instagram / Square",
		shortLabel: "1:1",
		canvas: { width: 1080, height: 1080 },
		ratio: "1:1",
	},
	{
		id: "classic",
		label: "Classic / 4:3",
		shortLabel: "4:3",
		canvas: { width: 1440, height: 1080 },
		ratio: "4:3",
	},
];

export const FPS_PRESETS = [
	{ value: "24", label: "24 fps" },
	{ value: "25", label: "25 fps" },
	{ value: "30", label: "30 fps" },
	{ value: "60", label: "60 fps" },
	{ value: "120", label: "120 fps" },
] as const;

export const BLUR_INTENSITY_PRESETS: { label: string; value: number }[] = [
	{ label: "Light", value: 4 },
	{ label: "Medium", value: 8 },
	{ label: "Heavy", value: 18 },
] as const;

export const DEFAULT_CANVAS_SIZE: TCanvasSize = { width: 1920, height: 1080 };
export const DEFAULT_FPS = 30;
export const DEFAULT_BLUR_INTENSITY = 8;
export const DEFAULT_COLOR = "#000000";

// ---------------------------------------------------------------------------
// Project Templates — pre-configured starting points for common use cases
// ---------------------------------------------------------------------------

export interface ProjectTemplate {
	id: string;
	name: string;
	description: string;
	icon: string;
	canvas: TCanvasSize;
	fps: number;
	tips: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
	{
		id: "youtube",
		name: "YouTube video",
		description: "Standard landscape video for YouTube",
		icon: "youtube",
		canvas: { width: 1920, height: 1080 },
		fps: 30,
		tips: [
			"Import your video and transcribe it",
			"Edit the text to cut mistakes and filler words",
			"Add subtitles for better engagement",
			"Export as MP4 high quality",
		],
	},
	{
		id: "tiktok",
		name: "TikTok / Reels",
		description: "Vertical short-form video",
		icon: "tiktok",
		canvas: { width: 1080, height: 1920 },
		fps: 30,
		tips: [
			"Keep it under 60 seconds for best reach",
			"Add bold subtitles — most viewers watch muted",
			"Remove silences for fast pacing",
			"Export as MP4 high quality",
		],
	},
	{
		id: "podcast",
		name: "Podcast clip",
		description: "Clean up podcast audio, add visual elements",
		icon: "podcast",
		canvas: { width: 1920, height: 1080 },
		fps: 24,
		tips: [
			"Transcribe to easily find the best clips",
			"Remove filler words and long pauses",
			"Add a lower-third with speaker name",
			"Clean audio to remove background noise",
		],
	},
	{
		id: "instagram",
		name: "Instagram post",
		description: "Square format for Instagram feed",
		icon: "instagram",
		canvas: { width: 1080, height: 1080 },
		fps: 30,
		tips: [
			"Keep it under 60 seconds for feed posts",
			"Add subtitles — most viewers watch muted",
			"Use the first 3 seconds to hook attention",
			"Export as MP4 high quality",
		],
	},
	{
		id: "presentation",
		name: "Presentation / tutorial",
		description: "Screen recording or educational content",
		icon: "presentation",
		canvas: { width: 1920, height: 1080 },
		fps: 30,
		tips: [
			"Transcribe to navigate by topic",
			"Remove mistakes by deleting sentences",
			"Add chapter markers for navigation",
			"Use infographic overlays for key points",
		],
	},
	{
		id: "custom",
		name: "Custom",
		description: "Start with your own settings",
		icon: "custom",
		canvas: { width: 1920, height: 1080 },
		fps: 30,
		tips: [
			"Choose your canvas size and frame rate",
			"Import any media to get started",
		],
	},
];
