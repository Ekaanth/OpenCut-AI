"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { toast } from "sonner";
import type { VideoBgJobStatus } from "@/lib/ai-client";

export interface VideoBgOptions {
	fps?: number;
	maxDuration?: number;
	/** When true (default), insert the result as a new clip on a track ABOVE
	 * the source (non-destructive). When false, the source clip is replaced. */
	nonDestructive?: boolean;
}

export interface VideoBgProgress {
	phase: "queued" | "extracting" | "processing" | "encoding" | "done";
	progress: number;
	processedFrames: number;
	totalFrames: number | null;
	message: string;
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 1000 * 60 * 30; // 30 min hard cap

function phaseFor(status: VideoBgJobStatus): VideoBgProgress["phase"] {
	const msg = (status.message || "").toLowerCase();
	if (status.status === "completed") return "done";
	if (msg.includes("extract")) return "extracting";
	if (msg.includes("encod")) return "encoding";
	if (status.status === "running") return "processing";
	return "queued";
}

/**
 * Per-frame video background removal (rembg). Resolves the source clip's
 * file, runs the job on the image-service, polls, then fetches the alpha
 * WebM and inserts it as a new video clip above the source (non-destructive
 * by default) so the original footage is preserved.
 */
export function useVideoBgRemoval() {
	const editor = useEditor();
	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState<VideoBgProgress | null>(null);
	const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const stopPolling = useCallback(() => {
		if (pollTimer.current) {
			clearTimeout(pollTimer.current);
			pollTimer.current = null;
		}
	}, []);

	/** Find the first selected video element with a backing file. Returns the
	 * file + the element's timeline placement so we can position the result. */
	const resolveSourceClip = useCallback(() => {
		const tracks = editor.timeline.getTracks();
		for (const track of tracks) {
			if (track.type !== "video") continue;
			for (const el of track.elements) {
				const mediaId = (el as { mediaId?: string }).mediaId;
				if (!mediaId) continue;
				const asset = editor.media.getAssets().find((a) => a.id === mediaId);
				if (asset?.file) {
					return {
						file: asset.file,
						element: el,
						track,
						startTime: el.startTime,
						duration: el.duration,
					};
				}
			}
		}
		return null;
	}, [editor]);

	const pollJob = useCallback(
		(jobId: string, taskId: string): Promise<VideoBgJobStatus> => {
			return new Promise((resolve, reject) => {
				const startedAt = Date.now();
				const tick = async () => {
					if (Date.now() - startedAt > MAX_POLL_MS) {
						reject(new Error("Video background removal timed out."));
						return;
					}
					try {
						const status = await aiClient.getVideoBgJob(jobId);
						setProgress({
							phase: phaseFor(status),
							progress: status.progress,
							processedFrames: status.processed_frames,
							totalFrames: status.total_frames,
							message: status.message,
						});
						useBackgroundTasksStore.getState().updateTask(taskId, {
							progress:
								status.total_frames && status.total_frames > 0
									? `${status.processed_frames}/${status.total_frames} frames`
									: status.message,
						});

						if (status.status === "completed") {
							resolve(status);
							return;
						}
						if (status.status === "failed") {
							reject(new Error(status.error || "Job failed."));
							return;
						}
					} catch (err) {
						reject(err);
						return;
					}
					pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
				};
				tick();
			});
		},
		[],
	);

	const applyResult = useCallback(
		async (
			status: VideoBgJobStatus,
			source: {
				startTime: number;
				duration: number;
				nonDestructive: boolean;
			},
		) => {
			const result = status.result;
			if (!result?.videoUrl) {
				throw new Error("Job completed but produced no video.");
			}

			// Fetch the transparent WebM as a blob and register it as a media asset.
			const resp = await fetch(aiClient.videoBgFileUrl(result.videoUrl));
			if (!resp.ok) throw new Error(`Failed to download result (${resp.status}).`);
			const blob = await resp.blob();
			const file = new File([blob], result.filename || `nobg-${Date.now()}.webm`, {
				type: "video/webm",
			});

			const project = editor.project.getActive();
			const mediaId = await editor.media.addMediaAsset({
				projectId: project.metadata.id,
				asset: {
					name: file.name,
					type: "video",
					file,
					url: URL.createObjectURL(file),
					duration: result.duration,
					width: result.width,
				},
			});

			// Create a fresh track ABOVE the source for the alpha clip by default.
			const targetTrackId = source.nonDestructive
				? editor.timeline.addTrack({ type: "video" })
				: editor.timeline.getTracks().find((t) => t.type === "video")?.id ??
					editor.timeline.addTrack({ type: "video" });

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: targetTrackId },
				element: {
					type: "video",
					mediaId,
					name: "No Background",
					startTime: source.startTime,
					duration: result.duration || source.duration,
					trimStart: 0,
					trimEnd: 0,
					transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
					opacity: 1,
				},
			});
		},
		[editor],
	);

	const run = useCallback(
		async (options: VideoBgOptions = {}) => {
			const source = resolveSourceClip();
			if (!source) {
				toast.error(
					"Select a video clip with a backing file first.",
				);
				return null;
			}
			const fps = options.fps ?? 8;
			const maxDuration = options.maxDuration ?? 120;
			const nonDestructive = options.nonDestructive ?? true;

			// Honest up-front estimate: ~1s per frame on CPU.
			const estFrames = Math.ceil(Math.min(source.duration, maxDuration) * fps);
			const estSeconds = estFrames; // ~1s/frame
			if (
				!window.confirm(
					`Remove background from this clip?\n\n` +
						`Estimated frames: ${estFrames} (${source.duration.toFixed(1)}s × ${fps} fps)\n` +
						`Estimated time: ~${Math.round(estSeconds)}s on CPU ` +
						`(faster on GPU). This runs per-frame with rembg.`,
				)
			) {
				return null;
			}

			setIsRunning(true);
			const taskId = `video-bg-${Date.now()}`;
			useBackgroundTasksStore.getState().addTask({
				id: taskId,
				type: "proxy-generation", // reuse an existing task type
				label: "Video BG Removal",
				progress: "Starting…",
			});

			try {
				const { job_id } = await aiClient.removeVideoBackground(
					source.file,
					fps,
					maxDuration,
				);
				const finalStatus = await pollJob(job_id, taskId);
				await applyResult(finalStatus, {
					startTime: source.startTime,
					duration: source.duration,
					nonDestructive,
				});

				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "completed",
					progress: `Done — ${finalStatus.result?.framesProcessed ?? 0} frames`,
					completedAt: Date.now(),
				});
				setProgress({ phase: "done", progress: 1, processedFrames: finalStatus.processed_frames, totalFrames: finalStatus.total_frames, message: "Done." });
				toast.success("Background removed — added as a new clip above the source.");
				return finalStatus;
			} catch (err) {
				const message = err instanceof Error ? err.message : "BG removal failed";
				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "error",
					error: message,
					completedAt: Date.now(),
				});
				toast.error("Background removal failed", { description: message });
				return null;
			} finally {
				setIsRunning(false);
				stopPolling();
			}
		},
		[resolveSourceClip, pollJob, applyResult, stopPolling],
	);

	return { run, isRunning, progress, cancel: stopPolling };
}
