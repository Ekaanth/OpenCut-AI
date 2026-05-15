import type { Chapter } from "@/types/ai";

export function formatTimeYouTube(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	}
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatYouTubeChapters(chapters: Chapter[]): string {
	return chapters
		.map((ch) => `${formatTimeYouTube(ch.start)} ${ch.title}`)
		.join("\n");
}

export function formatYouTubeDescription(options: {
	chapters: Chapter[];
	title?: string;
	description?: string;
	tags?: string[];
}): string {
	const parts: string[] = [];

	if (options.title) {
		parts.push(options.title);
		parts.push("");
	}

	if (options.description) {
		parts.push(options.description);
		parts.push("");
	}

	if (options.chapters.length > 0) {
		parts.push("Chapters:");
		for (const ch of options.chapters) {
			parts.push(`${formatTimeYouTube(ch.start)} ${ch.title}`);
		}
		parts.push("");
	}

	if (options.tags && options.tags.length > 0) {
		parts.push(options.tags.map((t) => `#${t.replace(/\s+/g, "")}`).join(" "));
	}

	return parts.join("\n").trim();
}

export async function copyYouTubeChapters(chapters: Chapter[]): Promise<void> {
	const text = formatYouTubeChapters(chapters);
	await navigator.clipboard.writeText(text);
}

export async function copyYouTubeDescription(options: {
	chapters: Chapter[];
	title?: string;
	description?: string;
	tags?: string[];
}): Promise<void> {
	const text = formatYouTubeDescription(options);
	await navigator.clipboard.writeText(text);
}
