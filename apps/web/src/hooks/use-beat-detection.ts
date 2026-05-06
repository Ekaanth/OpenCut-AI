import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import type { BeatDetectionResult, BeatMarker, BeatGridConfig } from "@/lib/audio/beat-detection-types";
import { DEFAULT_BEAT_GRID } from "@/lib/audio/beat-detection-types";
import { toast } from "sonner";

function detectBeatsFromBuffer(audioBuffer: AudioBuffer): BeatDetectionResult {
	const channelData = audioBuffer.getChannelData(0);
	const sampleRate = audioBuffer.sampleRate;

	const windowSize = Math.round(sampleRate * 0.01);
	const hopSize = Math.round(windowSize / 2);

	const energy: number[] = [];
	for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
		let sum = 0;
		for (let j = i; j < i + windowSize; j++) {
			sum += channelData[j] * channelData[j];
		}
		energy.push(sum / windowSize);
	}

	const threshold = energy.reduce((a, b) => a + b, 0) / energy.length;
	const peaks: number[] = [];
	for (let i = 1; i < energy.length - 1; i++) {
		if (
			energy[i] > energy[i - 1] &&
			energy[i] > energy[i + 1] &&
			energy[i] > threshold * 1.5
		) {
			peaks.push(i);
		}
	}

	const minBeatInterval = Math.round(sampleRate * 0.25 / hopSize);
	const beats: BeatMarker[] = [];
	let lastPeakIndex = -Infinity;

	for (const peak of peaks) {
		if (peak - lastPeakIndex >= minBeatInterval) {
			beats.push({
				time: (peak * hopSize) / sampleRate,
				strength: energy[peak] / (threshold * 3),
				index: beats.length,
			});
			lastPeakIndex = peak;
		}
	}

	let bpm = 120;
	if (beats.length >= 2) {
		const intervals: number[] = [];
		for (let i = 1; i < Math.min(beats.length, 50); i++) {
			intervals.push(beats[i].time - beats[i - 1].time);
		}
		const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		bpm = Math.round(60 / avgInterval);
		if (bpm > 200) bpm = Math.round(bpm / 2);
		if (bpm < 60) bpm = Math.round(bpm * 2);
	}

	return {
		bpm,
		beats,
		confidence: Math.min(beats.length / 20, 1),
	};
}

export function useBeatDetection() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [result, setResult] = useState<BeatDetectionResult | null>(null);
	const [gridConfig, setGridConfig] = useState<BeatGridConfig>(DEFAULT_BEAT_GRID);

	const detect = useCallback(
		async (mediaId?: string) => {
			const taskId = `beat-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "smart-cut",
				label: "Detecting Beats",
				progress: "Analyzing audio rhythm...",
			});

			try {
				const tracks = editor.timeline.getTracks();
				let audioBuffer: AudioBuffer | null = null;
				const audioContext = new AudioContext({ sampleRate: 44100 });

				for (const track of tracks) {
					if (track.type !== "audio" && track.type !== "video") continue;
					for (const el of track.elements) {
						const mediaEl = el as any;
						if (!mediaEl.mediaId) continue;
						if (mediaId && mediaEl.mediaId !== mediaId) continue;
						const asset = editor.media.getAssetById(mediaEl.mediaId);
						if (!asset?.file) continue;

						try {
							const ab = await asset.file.arrayBuffer();
							audioBuffer = await audioContext.decodeAudioData(ab);
							break;
						} catch {
							continue;
						}
					}
					if (audioBuffer) break;
				}

				audioContext.close();

				if (!audioBuffer) {
					throw new Error("No audio found in timeline");
				}

				const detection = detectBeatsFromBuffer(audioBuffer);
				setResult(detection);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Detected ${detection.bpm} BPM, ${detection.beats.length} beats`,
					completedAt: Date.now(),
				});

				toast.success(`Beat detection: ${detection.bpm} BPM, ${detection.beats.length} beats`);
			} catch (err) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: err instanceof Error ? err.message : "Detection failed",
					completedAt: Date.now(),
				});
			}
		},
		[editor, bgTasks],
	);

	const getNearestBeat = useCallback(
		(time: number): number | null => {
			if (!result) return null;
			let nearest = result.beats[0];
			let minDist = Infinity;
			for (const beat of result.beats) {
				const dist = Math.abs(beat.time - time);
				if (dist < minDist) {
					minDist = dist;
					nearest = beat;
				}
			}
			return nearest.time;
		},
		[result],
	);

	return { detect, result, gridConfig, setGridConfig, getNearestBeat };
}
