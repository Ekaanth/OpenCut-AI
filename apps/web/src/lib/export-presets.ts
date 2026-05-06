import type { ExportFormat, ExportQuality } from "@/types/export";
import type { TProjectSettings } from "@/types/project";
import { generateUUID } from "@/utils/id";

export interface ExportPreset {
	id: string;
	name: string;
	format: ExportFormat;
	quality: ExportQuality;
	canvasSize: { width: number; height: number };
	description: string;
}

export const PLATFORM_PRESETS: ExportPreset[] = [
	{
		id: "youtube-1080",
		name: "YouTube 1080p",
		format: "mp4",
		quality: "high",
		canvasSize: { width: 1920, height: 1080 },
		description: "H.264, 1080p, 30fps",
	},
	{
		id: "youtube-4k",
		name: "YouTube 4K",
		format: "mp4",
		quality: "very_high",
		canvasSize: { width: 3840, height: 2160 },
		description: "H.264, 4K, 30fps",
	},
	{
		id: "tiktok-reels",
		name: "TikTok / Reels",
		format: "mp4",
		quality: "high",
		canvasSize: { width: 1080, height: 1920 },
		description: "9:16, 1080x1920",
	},
	{
		id: "instagram-square",
		name: "Instagram Square",
		format: "mp4",
		quality: "high",
		canvasSize: { width: 1080, height: 1080 },
		description: "1:1, 1080x1080",
	},
	{
		id: "instagram-portrait",
		name: "Instagram Portrait",
		format: "mp4",
		quality: "high",
		canvasSize: { width: 1080, height: 1350 },
		description: "4:5, 1080x1350",
	},
	{
		id: "twitter",
		name: "Twitter / X",
		format: "mp4",
		quality: "medium",
		canvasSize: { width: 1280, height: 720 },
		description: "720p, max 140s",
	},
	{
		id: "podcast-audio",
		name: "Podcast (Audio Only)",
		format: "mp4",
		quality: "high",
		canvasSize: { width: 1920, height: 1080 },
		description: "Audio only, 320kbps",
	},
	{
		id: "web-email",
		name: "Web / Email",
		format: "webm",
		quality: "medium",
		canvasSize: { width: 1280, height: 720 },
		description: "WebM, 720p, small file",
	},
];

export interface ExportQueueItem {
	id: string;
	preset: ExportPreset;
	status: "queued" | "exporting" | "completed" | "error";
	progress: number;
	blob?: Blob;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

export function createQueueItem(preset: ExportPreset): ExportQueueItem {
	return {
		id: generateUUID(),
		preset,
		status: "queued",
		progress: 0,
	};
}
