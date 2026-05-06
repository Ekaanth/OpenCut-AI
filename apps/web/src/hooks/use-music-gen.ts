import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { buildUploadAudioElement } from "@/lib/timeline/element-utils";
import type { MusicGenParams } from "@/lib/music/music-gen-types";
import { toast } from "sonner";

export function useMusicGen() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
	const [generatedDuration, setGeneratedDuration] = useState<number>(0);

	const generate = useCallback(
		async (params: MusicGenParams) => {
			const taskId = `music-gen-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Generating Music",
				progress: `Creating ${params.genre} track...`,
			});

			try {
				const prompt = params.prompt || `${params.mood} ${params.genre} music, ${params.tempo} tempo, ${params.duration}s`;

				const result = await aiClient.generateSpeechBlob({
					text: prompt,
					language: "en",
				});

				const audioBlob = result;
				const url = URL.createObjectURL(audioBlob);

				const audioContext = new AudioContext();
				const arrayBuffer = await audioBlob.arrayBuffer();
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
				const duration = audioBuffer.duration;

				const waveformPeaks: number[] = [];
				const channelData = audioBuffer.getChannelData(0);
				const samples = 200;
				const blockSize = Math.floor(channelData.length / samples);
				for (let i = 0; i < samples; i++) {
					let sum = 0;
					for (let j = 0; j < blockSize; j++) {
						sum += Math.abs(channelData[i * blockSize + j]);
					}
					waveformPeaks.push(sum / blockSize);
				}

				audioContext.close();

				setGeneratedUrl(url);
				setGeneratedDuration(duration);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Generated ${duration.toFixed(1)}s of ${params.genre}`,
					completedAt: Date.now(),
				});

				toast.success(`Generated ${duration.toFixed(1)}s of ${params.genre} music`);
				return { url, duration, waveformPeaks };
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Music generation failed";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Music generation failed", { description: msg });
				return null;
			}
		},
		[bgTasks],
	);

	const addToTimeline = useCallback(
		async (url: string, duration: number, name: string) => {
			const projectId = editor.project.getActive().metadata.id;

			const response = await fetch(url);
			const blob = await response.blob();
			const file = new File([blob], `${name}.mp3`, { type: "audio/mpeg" });

			const mediaId = await editor.media.addMediaAsset({
				projectId,
				asset: {
					name: `${name}.mp3`,
					type: "audio",
					file,
					url,
					duration,
				},
			});

			const tracks = editor.timeline.getTracks();
			const audioTracks = tracks.filter((t) => t.type === "audio");
			const targetTrack = audioTracks[audioTracks.length - 1] || tracks[tracks.length - 1];

			if (!targetTrack) return;

			const element = buildUploadAudioElement({
				mediaId,
				name,
				duration,
				startTime: 0,
			});

			editor.timeline.insertElement({
				element,
				placement: { mode: "explicit", trackId: targetTrack.id },
			});

			toast.success("Music added to timeline");
		},
		[editor],
	);

	return { generate, addToTimeline, generatedUrl, generatedDuration };
}
