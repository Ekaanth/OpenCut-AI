import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { useTranscriptStore } from "@/stores/transcript-store";
import { aiClient } from "@/lib/ai-client";
import { buildImageElement } from "@/lib/timeline/element-utils";
import type { ThumbnailGenParams, ThumbnailGenResult } from "@/lib/thumbnail/thumbnail-gen-types";
import { toast } from "sonner";

export function useThumbnailGen() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const segments = useTranscriptStore((s) => s.segments);
	const [generatedThumbnails, setGeneratedThumbnails] = useState<ThumbnailGenResult[]>([]);

	const generate = useCallback(
		async (params: ThumbnailGenParams, count: number = 1) => {
			const taskId = `thumb-gen-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Generating Thumbnails",
				progress: "Creating thumbnail designs...",
			});

			try {
				let prompt = params.prompt;
				if (!prompt && segments.length > 0) {
					const topSegments = segments.slice(0, 5);
					prompt = `Video thumbnail for content about: ${topSegments.map((s) => s.text).join(" ").slice(0, 200)}`;
				}
				if (params.includeText && params.headline) {
					prompt += `. Include text: "${params.headline}"`;
				}
				prompt += `. Style: ${params.style}, ${params.colorScheme} colors, professional YouTube thumbnail`;

				const results: ThumbnailGenResult[] = [];

				for (let i = 0; i < count; i++) {
					const result = await aiClient.generateImage({
						prompt,
						width: params.width,
						height: params.height,
						steps: 30,
						guidanceScale: 7.5,
						negativePrompt: "blurry, low quality, watermark, text overlay (unless specified)",
					});

					results.push({
						imageUrl: result.imageUrl,
						seed: result.seed,
						width: params.width,
						height: params.height,
					});

					if (count > 1) {
						bgTasks.updateTask(taskId, {
							progress: `Generated ${i + 1}/${count} thumbnails...`,
						});
					}
				}

				setGeneratedThumbnails((prev) => [...results, ...prev]);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Generated ${count} thumbnails`,
					completedAt: Date.now(),
				});

				toast.success(`Generated ${count} thumbnail${count > 1 ? "s" : ""}`);
				return results;
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Thumbnail generation failed";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Thumbnail generation failed", { description: msg });
				return null;
			}
		},
		[bgTasks, segments],
	);

	const addToTimeline = useCallback(
		async (result: ThumbnailGenResult, name: string) => {
			const projectId = editor.project.getActive().metadata.id;

			const response = await fetch(result.imageUrl);
			const blob = await response.blob();
			const file = new File([blob], `${name}.png`, { type: "image/png" });
			const url = URL.createObjectURL(blob);

			const mediaId = await editor.media.addMediaAsset({
				projectId,
				asset: {
					name: `${name}.png`,
					type: "image",
					file,
					url,
					width: result.width,
					height: result.height,
					thumbnailUrl: url,
				},
			});

			const tracks = editor.timeline.getTracks();
			const targetTrack = tracks[0];
			if (!targetTrack) return;

			const element = buildImageElement({
				mediaId,
				name,
				duration: 5,
				startTime: 0,
			});

			editor.timeline.insertElement({
				element,
				placement: { mode: "explicit", trackId: targetTrack.id },
			});

			toast.success("Thumbnail added to timeline");
		},
		[editor],
	);

	const clearThumbnails = useCallback(() => {
		generatedThumbnails.forEach((t) => {
			if (t.imageUrl.startsWith("blob:")) URL.revokeObjectURL(t.imageUrl);
		});
		setGeneratedThumbnails([]);
	}, [generatedThumbnails]);

	return { generate, addToTimeline, generatedThumbnails, clearThumbnails };
}
