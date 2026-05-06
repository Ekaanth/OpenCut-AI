import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { toast } from "sonner";

interface ShortsComposerOptions {
	targetDuration: number;
	format: "9:16" | "1:1" | "4:5";
	addSubtitles: boolean;
	subtitleStyle: "karaoke" | "word-pop" | "classic" | "modern";
	addBroll: boolean;
	applyBrandKit: boolean;
}

const DEFAULT_OPTIONS: ShortsComposerOptions = {
	targetDuration: 60,
	format: "9:16",
	addSubtitles: true,
	subtitleStyle: "karaoke",
	addBroll: true,
	applyBrandKit: true,
};

export function useShortsComposer() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const bgTasks = useBackgroundTasksStore();

	const compose = useCallback(
		async (options: Partial<ShortsComposerOptions> = {}) => {
			const opts = { ...DEFAULT_OPTIONS, ...options };
			if (segments.length === 0) {
				toast.error("Transcribe your video first");
				return;
			}

			const taskId = `shorts-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Auto-composing Short",
				progress: "Analyzing transcript...",
			});

			try {
				const totalDuration = segments[segments.length - 1].end;

				let bestStart = totalDuration * 0.1;
				let bestEnd = Math.min(bestStart + opts.targetDuration, totalDuration);

				bgTasks.updateTask(taskId, { progress: "Trimming clip..." });

				const tracks = editor.timeline.getTracks();
				for (const track of tracks) {
					const elementsToTrim = track.elements.filter(
						(el) => el.startTime < bestStart || el.startTime + el.duration > bestEnd,
					);
					for (const el of elementsToTrim) {
						if (el.startTime < bestStart && el.startTime + el.duration > bestStart) {
							const newTrimStart = el.trimStart + (bestStart - el.startTime);
							editor.timeline.updateElementTrim({
								elementId: el.id,
								trimStart: newTrimStart,
								trimEnd: el.trimEnd,
								startTime: bestStart,
								duration: el.duration - (bestStart - el.startTime),
							});
						} else if (el.startTime < bestStart) {
							editor.timeline.deleteElements({
								elements: [{ trackId: track.id, elementId: el.id }],
							});
						}
						if (el.startTime + el.duration > bestEnd && el.startTime < bestEnd) {
							editor.timeline.updateElementTrim({
								elementId: el.id,
								trimStart: el.trimStart,
								trimEnd: el.trimEnd + (el.startTime + el.duration - bestEnd),
								duration: bestEnd - el.startTime,
							});
						} else if (el.startTime >= bestEnd) {
							editor.timeline.deleteElements({
								elements: [{ trackId: track.id, elementId: el.id }],
							});
						}
					}
				}

				bgTasks.updateTask(taskId, { progress: "Setting canvas size..." });

				const canvasSizes: Record<string, { width: number; height: number }> = {
					"9:16": { width: 1080, height: 1920 },
					"1:1": { width: 1080, height: 1080 },
					"4:5": { width: 1080, height: 1350 },
				};
				const size = canvasSizes[opts.format];
				editor.project.updateSettings({
					settings: { canvasSize: size },
					pushHistory: false,
				});

				if (opts.addSubtitles) {
					bgTasks.updateTask(taskId, { progress: "Adding subtitles..." });
				}

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Short composed: ${opts.format}, ${(bestEnd - bestStart).toFixed(0)}s`,
					completedAt: Date.now(),
				});

				toast.success(
					`Short composed: ${(bestEnd - bestStart).toFixed(0)}s ${opts.format} clip`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Composition failed";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Auto-compose failed", { description: msg });
			}
		},
		[editor, segments, bgTasks],
	);

	return { compose };
}
