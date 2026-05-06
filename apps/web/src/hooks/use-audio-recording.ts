import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { buildUploadAudioElement } from "@/lib/timeline/element-utils";
import { toast } from "sonner";

interface RecordingState {
	isRecording: boolean;
	isPaused: boolean;
	duration: number;
	levels: number[];
}

export function useAudioRecording() {
	const editor = useEditor();
	const [state, setState] = useState<RecordingState>({
		isRecording: false,
		isPaused: false,
		duration: 0,
		levels: new Array(8).fill(0),
	});

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const startTimeRef = useRef<number>(0);
	const pausedDurationRef = useRef<number>(0);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 48000,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;
			chunksRef.current = [];

			const audioContext = new AudioContext({ sampleRate: 48000 });
			audioContextRef.current = audioContext;

			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
					? "audio/webm;codecs=opus"
					: "audio/webm",
			});

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data);
				}
			};

			mediaRecorderRef.current = mediaRecorder;
			mediaRecorder.start(100);

			startTimeRef.current = Date.now();
			pausedDurationRef.current = 0;

			timerRef.current = setInterval(() => {
				const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;

				const levels: number[] = [];
				if (analyserRef.current) {
					const data = new Uint8Array(analyserRef.current.frequencyBinCount);
					analyserRef.current.getByteFrequencyData(data);
					const bandSize = Math.floor(data.length / 8);
					for (let i = 0; i < 8; i++) {
						let sum = 0;
						for (let j = 0; j < bandSize; j++) {
							sum += data[i * bandSize + j];
						}
						levels.push(sum / bandSize / 255);
					}
				}

				setState((prev) => ({
					...prev,
					duration: elapsed,
					levels,
				}));
			}, 50);

			setState((prev) => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
		} catch (err) {
			toast.error("Could not access microphone", {
				description: err instanceof Error ? err.message : "Permission denied",
			});
		}
	}, []);

	const pauseRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.pause();
			if (timerRef.current) clearInterval(timerRef.current);
			setState((prev) => ({ ...prev, isPaused: true }));
		}
	}, []);

	const resumeRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "paused") {
			mediaRecorderRef.current.resume();
			const pauseStart = Date.now();
			startTimeRef.current = startTimeRef.current;

			timerRef.current = setInterval(() => {
				const elapsed = (Date.now() - startTimeRef.current) / 1000;
				setState((prev) => ({ ...prev, duration: elapsed }));
			}, 50);

			setState((prev) => ({ ...prev, isPaused: false }));
		}
	}, []);

	const stopRecording = useCallback(async (): Promise<{ blob: Blob; duration: number } | null> => {
		return new Promise((resolve) => {
			const recorder = mediaRecorderRef.current;
			if (!recorder || recorder.state === "inactive") {
				resolve(null);
				return;
			}

			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: "audio/webm" });
				const duration = state.duration;

				if (streamRef.current) {
					streamRef.current.getTracks().forEach((t) => t.stop());
					streamRef.current = null;
				}
				if (audioContextRef.current) {
					audioContextRef.current.close();
					audioContextRef.current = null;
				}
				if (timerRef.current) {
					clearInterval(timerRef.current);
					timerRef.current = null;
				}

				mediaRecorderRef.current = null;
				analyserRef.current = null;

				setState({
					isRecording: false,
					isPaused: false,
					duration: 0,
					levels: new Array(8).fill(0),
				});

				resolve({ blob, duration });
			};

			recorder.stop();
		});
	}, [state.duration]);

	const addToTimeline = useCallback(
		async (blob: Blob, duration: number, name: string) => {
			const projectId = editor.project.getActive().metadata.id;
			const file = new File([blob], `${name}.webm`, { type: "audio/webm" });
			const url = URL.createObjectURL(blob);

			const mediaId = await editor.media.addMediaAsset({
				projectId,
				asset: {
					name: `${name}.webm`,
					type: "audio",
					file,
					url,
					duration,
				},
			});

			const tracks = editor.timeline.getTracks();
			const audioTracks = tracks.filter((t) => t.type === "audio");
			const targetTrack =
				audioTracks[audioTracks.length - 1] || tracks[tracks.length - 1];
			if (!targetTrack) return;

			const playheadTime = editor.playback.getCurrentTime();

			const element = buildUploadAudioElement({
				mediaId,
				name,
				duration,
				startTime: playheadTime,
			});

			editor.timeline.insertElement({
				element,
				placement: { mode: "explicit", trackId: targetTrack.id },
			});

			toast.success("Recording added to timeline");
		},
		[editor],
	);

	return {
		state,
		startRecording,
		pauseRecording,
		resumeRecording,
		stopRecording,
		addToTimeline,
	};
}
