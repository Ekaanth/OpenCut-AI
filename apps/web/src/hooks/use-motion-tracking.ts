import { useCallback, useRef, useState } from "react";

import { useEditor } from "@/hooks/use-editor";
import {
	type MotionTrack,
	type TrackingFrame,
	type TrackingOptions,
	type TrackingRegion,
	DEFAULT_TRACKING_OPTIONS,
	extractGrayscalePatch,
	findBestMatch,
} from "@/lib/motion-tracking/tracking-types";
import type { NumberKeyframe } from "@/types/animation";
import type { VideoElement } from "@/types/timeline";

export type TrackingStatus = "idle" | "extracting" | "tracking" | "applying" | "done" | "error";

export interface UseMotionTrackingReturn {
	status: TrackingStatus;
	progress: number;
	track: MotionTrack | null;
	error: string | null;
	startTracking: (
		elementId: string,
		trackId: string,
		region: TrackingRegion,
		options?: Partial<TrackingOptions>,
	) => Promise<void>;
	applyTrack: () => void;
	reset: () => void;
}

export function useMotionTracking(): UseMotionTrackingReturn {
	const editor = useEditor();
	const [status, setStatus] = useState<TrackingStatus>("idle");
	const [progress, setProgress] = useState(0);
	const [track, setTrack] = useState<MotionTrack | null>(null);
	const [error, setError] = useState<string | null>(null);
	const cancelRef = useRef(false);

	const startTracking = useCallback(
		async (
			elementId: string,
			trackId: string,
			region: TrackingRegion,
			options?: Partial<TrackingOptions>,
		) => {
			setStatus("extracting");
			setProgress(0);
			setError(null);
			setTrack(null);
			cancelRef.current = false;

			try {
				const opts: TrackingOptions = { ...DEFAULT_TRACKING_OPTIONS, ...options };
				const tracks = editor.timeline.getTracks();
				const tlTrack = tracks.find((t) => t.id === trackId);
				if (!tlTrack) throw new Error("Track not found");

				const element = tlTrack.elements.find((e) => e.id === elementId);
				if (!element || element.type !== "video") throw new Error("Element must be a video");

				const videoEl = element as VideoElement;
				if (!videoEl.mediaId) throw new Error("Video has no media source");

				const media = editor.media.getAssetById(videoEl.mediaId);
				if (!media?.file) throw new Error("Media file not available");

				const video = document.createElement("video");
				video.src = URL.createObjectURL(media.file);
				video.muted = true;
				video.playsInline = true;

				await new Promise<void>((resolve, reject) => {
					video.onloadedmetadata = () => resolve();
					video.onerror = () => reject(new Error("Failed to load video"));
				});

				const duration = video.duration;
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				if (!ctx) throw new Error("Canvas 2D not available");

				const sampleInterval = opts.sampleInterval;
				const totalFrames = Math.ceil(duration / sampleInterval);
				const templateW = Math.max(16, Math.floor(region.width * opts.templateScale));
				const templateH = Math.max(16, Math.floor(region.height * opts.templateScale));

				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;

				video.currentTime = 0;
				await new Promise<void>((r) => { video.onseeked = () => r(); });

				ctx.drawImage(video, 0, 0);
				const firstFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

				const template = extractGrayscalePatch(firstFrame, region, templateW, templateH);

				const frames: TrackingFrame[] = [];
				let lastX = region.x + region.width / 2;
				let lastY = region.y + region.height / 2;

				setStatus("tracking");

				for (let i = 0; i < totalFrames; i++) {
					if (cancelRef.current) {
						URL.revokeObjectURL(video.src);
						setStatus("idle");
						return;
					}

					const time = i * sampleInterval;
					video.currentTime = Math.min(time, duration);
					await new Promise<void>((r) => { video.onseeked = () => r(); });

					ctx.drawImage(video, 0, 0);
					const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

					const searchRegion: TrackingRegion = {
						x: Math.max(0, lastX - region.width / 2 - opts.searchRadius),
						y: Math.max(0, lastY - region.height / 2 - opts.searchRadius),
						width: region.width + opts.searchRadius * 2,
						height: region.height + opts.searchRadius * 2,
					};

					const searchW = Math.max(16, Math.floor(searchRegion.width * opts.templateScale));
					const searchH = Math.max(16, Math.floor(searchRegion.height * opts.templateScale));

					const searchPatch = extractGrayscalePatch(frameData, searchRegion, searchW, searchH);

					const match = findBestMatch(
						template, searchPatch, templateW, templateH, searchW, searchH,
						Math.floor(opts.searchRadius * opts.templateScale),
					);

					const newX = searchRegion.x + searchRegion.width / 2 + match.offsetX / opts.templateScale;
					const newY = searchRegion.y + searchRegion.height / 2 + match.offsetY / opts.templateScale;

					frames.push({
						time,
						point: { x: newX, y: newY },
						confidence: match.confidence,
					});

					lastX = newX;
					lastY = newY;
					setProgress(Math.round((i / totalFrames) * 100));
				}

				URL.revokeObjectURL(video.src);

				const motionTrack: MotionTrack = {
					id: `track-${Date.now()}`,
					elementId,
					trackId,
					property: "transform.position",
					frames,
					startTime: 0,
					endTime: duration,
				};

				setTrack(motionTrack);
				setProgress(100);
				setStatus("done");
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Motion tracking failed");
			}
		},
		[editor],
	);

	const applyTrack = useCallback(() => {
		if (!track || track.frames.length === 0) return;

		setStatus("applying");

		try {
			const tracks = editor.timeline.getTracks();
			const tlTrack = tracks.find((t) => t.id === track.trackId);
			if (!tlTrack) return;

			const element = tlTrack.elements.find((e) => e.id === track.elementId);
			if (!element) return;

			const animations = { ...element.animations };
			const channels = { ...animations?.channels };

			const firstFrame = track.frames[0];
			const baseX = firstFrame.point.x;
			const baseY = firstFrame.point.y;

			const xKeyframes: NumberKeyframe[] = track.frames
				.filter((f) => f.confidence >= DEFAULT_TRACKING_OPTIONS.minConfidence)
				.map((f, i) => ({
					id: `mtx-${i}`,
					time: f.time,
					value: f.point.x - baseX,
					interpolation: "linear" as const,
				}));

			const yKeyframes: NumberKeyframe[] = track.frames
				.filter((f) => f.confidence >= DEFAULT_TRACKING_OPTIONS.minConfidence)
				.map((f, i) => ({
					id: `mty-${i}`,
					time: f.time,
					value: f.point.y - baseY,
					interpolation: "linear" as const,
				}));

			if (xKeyframes.length > 0) {
				channels["transform.position.x"] = {
					valueKind: "number",
					keyframes: xKeyframes,
				};
			}

			if (yKeyframes.length > 0) {
				channels["transform.position.y"] = {
					valueKind: "number",
					keyframes: yKeyframes,
				};
			}

			element.animations = { channels };
			setStatus("done");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Failed to apply tracking data");
		}
	}, [track, editor]);

	const reset = useCallback(() => {
		cancelRef.current = true;
		setStatus("idle");
		setProgress(0);
		setTrack(null);
		setError(null);
	}, []);

	return { status, progress, track, error, startTracking, applyTrack, reset };
}
