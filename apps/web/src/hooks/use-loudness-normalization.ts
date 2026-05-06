import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import type { LUFSMeasurement, NormalizationConfig } from "@/lib/audio/loudness-types";
import { DEFAULT_NORMALIZATION } from "@/lib/audio/loudness-types";
import { toast } from "sonner";

function measureLUFS(audioBuffer: AudioBuffer): LUFSMeasurement {
	const sampleRate = audioBuffer.sampleRate;
	const channelData = audioBuffer.getChannelData(0);
	const blockSize = Math.round(sampleRate * 0.4);
	const kWeightingFreq = 1681.0;
	const gb = Math.pow(10, 0.064 * 1);

	const blockLoudness: number[] = [];
	let maxMomentary = -Infinity;
	let maxTruePeak = -Infinity;

	for (let i = 0; i < channelData.length; i += blockSize) {
		const end = Math.min(i + blockSize, channelData.length);
		let sum = 0;
		let peak = 0;
		for (let j = i; j < end; j++) {
			sum += channelData[j] * channelData[j];
			const abs = Math.abs(channelData[j]);
			if (abs > peak) peak = abs;
		}
		const rms = sum / (end - i);
		const loudness = 10 * Math.log10(rms + 1e-10);
		blockLoudness.push(loudness);
		if (loudness > maxMomentary) maxMomentary = loudness;
		if (peak > maxTruePeak) maxTruePeak = peak;
	}

	const validBlocks = blockLoudness.filter((l) => l > -70);
	const gatedLoudness =
		validBlocks.length > 0
			? validBlocks.reduce((a, b) => a + b, 0) / validBlocks.length
			: -70;

	const threshold = gatedLoudness - 10;
	const finalBlocks = validBlocks.filter((l) => l > threshold);
	const integrated =
		finalBlocks.length > 0 ? finalBlocks.reduce((a, b) => a + b, 0) / finalBlocks.length : -70;

	return {
		integrated: Math.round(integrated * 10) / 10,
		shortTerm: Math.round(gatedLoudness * 10) / 10,
		momentary: Math.round(maxMomentary * 10) / 10,
		truePeak: Math.round(20 * Math.log10(maxTruePeak + 1e-10) * 10) / 10,
		range: Math.round(
			(finalBlocks.length > 0
				? Math.max(...finalBlocks) - Math.min(...finalBlocks)
				: 0) * 10,
		) / 10,
	};
}

export function useLoudnessNormalization() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [measurement, setMeasurement] = useState<LUFSMeasurement | null>(null);

	const analyze = useCallback(async () => {
		const taskId = `lufs-${Date.now()}`;
		bgTasks.addTask({
			id: taskId,
			type: "smart-cut",
			label: "Measuring Loudness",
			progress: "Analyzing audio levels...",
		});

		try {
			const tracks = editor.timeline.getTracks();
			const audioTracks = tracks.filter((t) => t.type === "audio" || t.type === "video");

			let allSamples: Float32Array = new Float32Array(0);
			const audioContext = new AudioContext({ sampleRate: 48000 });

			for (const track of audioTracks) {
				for (const el of track.elements) {
					const mediaEl = el as any;
					if (!mediaEl.mediaId) continue;
					const asset = editor.media.getAssetById(mediaEl.mediaId);
					if (!asset?.file) continue;

					try {
						const arrayBuffer = await asset.file.arrayBuffer();
						const buffer = await audioContext.decodeAudioData(arrayBuffer);
						const channelData = buffer.getChannelData(0);
						const merged = new Float32Array(allSamples.length + channelData.length);
						merged.set(allSamples);
						merged.set(channelData, allSamples.length);
						allSamples = merged;
					} catch {
						continue;
					}
				}
			}

			audioContext.close();

			if (allSamples.length === 0) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: "No audio found in timeline",
					completedAt: Date.now(),
				});
				return;
			}

			const fakeBuffer = {
				sampleRate: 48000,
				getChannelData: () => allSamples,
				duration: allSamples.length / 48000,
				length: allSamples.length,
				numberOfChannels: 1,
			} as unknown as AudioBuffer;

			const result = measureLUFS(fakeBuffer);
			setMeasurement(result);

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `Integrated: ${result.integrated} LUFS`,
				completedAt: Date.now(),
			});
		} catch (err) {
			bgTasks.updateTask(taskId, {
				status: "error",
				error: err instanceof Error ? err.message : "Analysis failed",
				completedAt: Date.now(),
			});
		}
	}, [editor, bgTasks]);

	const normalize = useCallback(
		async (config: NormalizationConfig = DEFAULT_NORMALIZATION) => {
			if (!measurement) {
				toast.error("Analyze first to measure current loudness");
				return;
			}

			const deltaLUFS = config.targetLUFS - measurement.integrated;
			const gainLinear = Math.pow(10, deltaLUFS / 20);
			const gainDb = Math.round(deltaLUFS * 100) / 100;

			const tracks = editor.timeline.getTracks();
			for (const track of tracks) {
				if (track.type === "audio" || track.type === "video") {
					if ("volume" in track) {
						const currentVol = (track as any).volume ?? 1;
						editor.timeline.updateTrack({
							trackId: track.id,
							updates: { volume: Math.min(currentVol * gainLinear, 2) },
						});
					}
				}
			}

			toast.success(`Normalized to ${config.targetLUFS} LUFS (${gainDb > 0 ? "+" : ""}${gainDb} dB)`);
		},
		[editor, measurement],
	);

	return { analyze, normalize, measurement };
}
