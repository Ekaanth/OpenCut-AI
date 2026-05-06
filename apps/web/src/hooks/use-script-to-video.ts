import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import type { ScriptToVideoConfig } from "@/lib/script-to-video/script-types";
import { DEFAULT_SCRIPT_CONFIG } from "@/lib/script-to-video/script-types";
import { toast } from "sonner";

export function useScriptToVideo() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();

	const generate = useCallback(
		async (script: string, config: Partial<ScriptToVideoConfig> = {}) => {
			const cfg = { ...DEFAULT_SCRIPT_CONFIG, ...config };
			const taskId = `s2v-${Date.now()}`;

			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Script to Video",
				progress: "Parsing script...",
			});

			try {
				const lines = script.split("\n").filter((l) => l.trim().length > 0);
				const sections: Array<{
					text: string;
					type: "narration" | "title";
					duration: number;
				}> = [];

				for (const line of lines) {
					const wordCount = line.trim().split(/\s+/).length;
					const duration = Math.max(2, (wordCount / 150) * 60);
					sections.push({
						text: line.trim(),
						type: line.startsWith("#") ? "title" : "narration",
						duration,
					});
				}

				bgTasks.updateTask(taskId, { progress: "Generating voiceover..." });

				const fullText = lines
					.filter((l) => !l.startsWith("#"))
					.join(" ");

				if (fullText.trim().length === 0) {
					throw new Error("Script has no narration text");
				}

				const audioBlob = await aiClient.generateSpeechBlob({
					text: fullText,
					language: cfg.language,
				});

				const audioUrl = URL.createObjectURL(audioBlob);
				const audioContext = new AudioContext();
				const audioBuffer = await audioContext.decodeAudioData(
					await audioBlob.arrayBuffer(),
				);
				const totalAudioDuration = audioBuffer.duration;
				audioContext.close();

				bgTasks.updateTask(taskId, { progress: "Generating visuals..." });

				const prompts: string[] = [];
				let currentTime = 0;
				for (const section of sections) {
					const prompt = `${cfg.style} style, ${section.text.slice(0, 100)}, high quality`;
					prompts.push(prompt);
					currentTime += section.duration;
				}

				const canvasSizes: Record<string, { width: number; height: number }> = {
					"16:9": { width: 1920, height: 1080 },
					"9:16": { width: 1080, height: 1920 },
					"1:1": { width: 1080, height: 1080 },
					"4:5": { width: 1080, height: 1350 },
				};
				const size = canvasSizes[cfg.aspectRatio];

				const generatedImages: string[] = [];
				for (let i = 0; i < Math.min(prompts.length, 10); i++) {
					try {
						const result = await aiClient.generateImage({
							prompt: prompts[i],
							width: size.width,
							height: size.height,
							steps: 20,
							guidanceScale: 7,
						});
						generatedImages.push(result.imageUrl);
					} catch {
						generatedImages.push("");
					}
				}

				bgTasks.updateTask(taskId, { progress: "Building timeline..." });

				editor.project.updateSettings({
					settings: { canvasSize: size },
					pushHistory: false,
				});

				const projectId = editor.project.getActive().metadata.id;

				const audioFile = new File([audioBlob], "narration.webm", {
					type: "audio/webm",
				});
				const audioMediaId = await editor.media.addMediaAsset({
					projectId,
					asset: {
						name: "narration.webm",
						type: "audio",
						file: audioFile,
						url: audioUrl,
						duration: totalAudioDuration,
					},
				});

				const tracks = editor.timeline.getTracks();
				const audioTrack = tracks.find((t) => t.type === "audio");

				if (audioTrack) {
					editor.timeline.insertElement({
						element: {
							type: "audio",
							sourceType: "upload",
							mediaId: audioMediaId,
							name: "Narration",
							startTime: 0,
							duration: totalAudioDuration,
							trimStart: 0,
							trimEnd: 0,
							sourceDuration: totalAudioDuration,
							volume: 1,
							muted: false,
						},
						placement: { mode: "explicit", trackId: audioTrack.id },
					});
				}

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Video created: ${totalAudioDuration.toFixed(0)}s, ${sections.length} sections`,
					completedAt: Date.now(),
				});

				toast.success(
					`Script-to-video created: ${totalAudioDuration.toFixed(0)}s with ${sections.length} sections`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Generation failed";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Script-to-video failed", { description: msg });
			}
		},
		[editor, bgTasks],
	);

	return { generate };
}
