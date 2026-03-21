import type { ExportOptions } from "@/types/export";

export const DEFAULT_EXPORT_OPTIONS = {
	format: "mp4",
	quality: "high",
	includeAudio: true,
} satisfies ExportOptions;

export const EXPORT_MIME_TYPES = {
	webm: "video/webm",
	mp4: "video/mp4",
} as const;

// ---------------------------------------------------------------------------
// Smart Export Presets — platform-optimized export configurations
// ---------------------------------------------------------------------------

export interface ExportPreset {
	id: string;
	name: string;
	description: string;
	options: ExportOptions;
	tip?: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
	{
		id: "youtube",
		name: "YouTube",
		description: "1080p MP4, best compatibility",
		options: { format: "mp4", quality: "high", includeAudio: true },
		tip: "YouTube re-encodes everything, so high quality gives the best result after processing.",
	},
	{
		id: "youtube-4k",
		name: "YouTube 4K",
		description: "Maximum quality for large screens",
		options: { format: "mp4", quality: "very_high", includeAudio: true },
		tip: "Upload at the highest quality your source allows. YouTube will create lower-res versions automatically.",
	},
	{
		id: "tiktok",
		name: "TikTok / Reels",
		description: "9:16 MP4, optimized for mobile",
		options: { format: "mp4", quality: "high", includeAudio: true },
		tip: "Keep under 60s for best reach. TikTok compresses heavily, so export at high quality.",
	},
	{
		id: "instagram",
		name: "Instagram",
		description: "MP4, works for feed, stories, and reels",
		options: { format: "mp4", quality: "high", includeAudio: true },
		tip: "Square (1:1) for feed posts, vertical (9:16) for stories and reels.",
	},
	{
		id: "twitter",
		name: "Twitter / X",
		description: "MP4, 2 min 20s limit on free tier",
		options: { format: "mp4", quality: "medium", includeAudio: true },
		tip: "Twitter has a 512MB limit. Medium quality keeps file size manageable.",
	},
	{
		id: "web",
		name: "Web / email",
		description: "WebM, smaller file size",
		options: { format: "webm", quality: "medium", includeAudio: true },
		tip: "WebM gives smaller files for embedding in websites. Not all email clients support video.",
	},
	{
		id: "podcast",
		name: "Podcast (audio only)",
		description: "Audio extracted, no video",
		options: { format: "mp4", quality: "medium", includeAudio: true },
		tip: "For audio-only distribution, extract the audio after export using any converter.",
	},
	{
		id: "custom",
		name: "Custom",
		description: "Choose your own format and quality",
		options: { format: "mp4", quality: "high", includeAudio: true },
	},
];
