import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import {
	computeHistogram,
	chiSquaredDistance,
} from "@/lib/scene-detection/frame-differ";
import type {
	SceneChange,
	SceneDetectionOptions,
} from "@/lib/scene-detection/scene-detection-types";
import { DEFAULT_SCENE_OPTIONS } from "@/lib/scene-detection/scene-detection-types";
import { toast } from "sonner";

function extractFrame(
	video: HTMLVideoElement,
	canvas: HTMLCanvasElement,
	time: number,
): Promise<string | null> {
	return new Promise((resolve) => {
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			resolve(null);
			return;
		}

		const onSeeked = () => {
			video.removeEventListener("seeked", onSeeked);
			try {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				ctx.drawImage(video, 0, 0);
				const dataUrl = canvas.toDataURL("image/jpeg", 0.3);
				resolve(dataUrl);
			} catch {
				resolve(null);
			}
		};

		video.addEventListener("seeked", onSeeked);
		video.currentTime = time;

		setTimeout(() => {
			video.removeEventListener("seeked", onSeeked);
			resolve(null);
		}, 5000);
	});
}

export function useSceneDetection() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [scenes, setScenes] = useState<SceneChange[]>([]);
	const [isDetecting, setIsDetecting] = useState(false);

	const detect = useCallback(
		async (options: Partial<SceneDetectionOptions> = {}) => {
			const opts = { ...DEFAULT_SCENE_OPTIONS, ...options };
			setIsDetecting(true);

			const taskId = `scene-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "smart-cut",
				label: "Detecting Scenes",
				progress: "Extracting frames...",
			});

			try {
				const mediaAssets = editor.media.getAssets();
				const videoAsset = mediaAssets.find((a) => a.type === "video");
				if (!videoAsset?.file) {
					throw new Error("No video file found");
				}

				const url = URL.createObjectURL(videoAsset.file);
				const video = document.createElement("video");
				video.crossOrigin = "anonymous";
				video.muted = true;
				video.preload = "auto";
				video.src = url;

				await new Promise<void>((resolve, reject) => {
					video.onloadedmetadata = () => resolve();
					video.onerror = () => reject(new Error("Failed to load video"));
				});

				const duration = video.duration;
				const interval = opts.sampleInterval;
				const numFrames = Math.min(
					Math.ceil(duration / interval),
					opts.maxFrames,
				);

				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Canvas context unavailable");

				const thumbCanvas = document.createElement("canvas");
				const thumbCtx = thumbCanvas.getContext("2d");

				let prevHistogram: Float32Array | null = null;
				let prevFrameUrl: string | null = null;
				const detected: SceneChange[] = [];

				for (let i = 0; i < numFrames; i++) {
					const time = interval * (i + 0.5);
					if (time > duration) break;

					const frameUrl = await extractFrame(video, canvas, time);
					if (!frameUrl) continue;

					const img = new Image();
					await new Promise<void>((resolve) => {
						img.onload = () => resolve();
						img.onerror = () => resolve();
						img.src = frameUrl;
					});

					canvas.width = img.width;
					canvas.height = img.height;
					ctx.drawImage(img, 0, 0);

					const currentHistogram = computeHistogram(
						ctx,
						0,
						0,
						img.width,
						img.height,
					);

					if (prevHistogram) {
						const distance = chiSquaredDistance(
							prevHistogram,
							currentHistogram,
						);

						if (distance > opts.threshold) {
							let thumbBefore: string | undefined;
							let thumbAfter: string | undefined;

							if (opts.captureThumbnails && thumbCtx) {
								thumbCanvas.width = opts.thumbnailWidth;
								thumbCanvas.height = Math.round(
									opts.thumbnailWidth * (img.height / img.width),
								);

								if (prevFrameUrl) {
									const prevImg = new Image();
									await new Promise<void>((resolve) => {
										prevImg.onload = () => resolve();
										prevImg.onerror = () => resolve();
										prevImg.src = prevFrameUrl as string;
									});
									thumbCtx.drawImage(
										prevImg,
										0,
										0,
										thumbCanvas.width,
										thumbCanvas.height,
									);
									thumbBefore = thumbCanvas.toDataURL("image/jpeg", 0.4);
								}

								thumbCtx.drawImage(
									img,
									0,
									0,
									thumbCanvas.width,
									thumbCanvas.height,
								);
								thumbAfter = thumbCanvas.toDataURL("image/jpeg", 0.4);
							}

							detected.push({
								time,
								confidence: Math.min(distance / (opts.threshold * 2), 1),
								type: distance > opts.threshold * 2 ? "cut" : "dissolve",
								frameBefore: thumbBefore,
								frameAfter: thumbAfter,
								index: detected.length,
							});
						}
					}

					prevHistogram = currentHistogram;
					prevFrameUrl = frameUrl;

					if (i % 20 === 0) {
						bgTasks.updateTask(taskId, {
							progress: `Analyzing frame ${i}/${numFrames}...`,
						});
					}
				}

				URL.revokeObjectURL(url);

				const merged = mergeCloseScenes(detected, interval * 0.6);
				setScenes(merged);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Detected ${merged.length} scene changes`,
					completedAt: Date.now(),
				});

				toast.success(`Detected ${merged.length} scene changes`);
			} catch (err) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: err instanceof Error ? err.message : "Detection failed",
					completedAt: Date.now(),
				});
				toast.error("Scene detection failed");
			} finally {
				setIsDetecting(false);
			}
		},
		[editor, bgTasks],
	);

	const splitAtScenes = useCallback(() => {
		if (scenes.length === 0) return;
		toast.info(
			`Would split at ${scenes.length} scene boundaries — split-at-time API needed`,
		);
	}, [scenes]);

	return { detect, scenes, isDetecting, splitAtScenes };
}

function mergeCloseScenes(
	scenes: SceneChange[],
	minGap: number,
): SceneChange[] {
	if (scenes.length === 0) return [];
	const merged: SceneChange[] = [scenes[0]];
	for (let i = 1; i < scenes.length; i++) {
		const prev = merged[merged.length - 1];
		if (scenes[i].time - prev.time < minGap) {
			if (scenes[i].confidence > prev.confidence) {
				merged[merged.length - 1] = scenes[i];
			}
		} else {
			merged.push(scenes[i]);
		}
	}
	return merged.map((s, i) => ({ ...s, index: i }));
}
