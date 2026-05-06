import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import type { MediaAsset } from "@/types/assets";
import type { VideoElement, ImageElement } from "@/types/timeline";

interface FilmstripState {
	thumbnails: string[];
	loading: boolean;
}

const CACHE = new Map<string, string[]>();
const MAX_CACHE_SIZE = 100;

function pruneCache() {
	if (CACHE.size > MAX_CACHE_SIZE) {
		const keys = Array.from(CACHE.keys());
		for (let i = 0; i < keys.length - MAX_CACHE_SIZE; i++) {
			CACHE.delete(keys[i]);
		}
	}
}

async function generateFilmstrip({
	mediaAsset,
	numFrames,
	width,
	height,
}: {
	mediaAsset: MediaAsset;
	numFrames: number;
	width: number;
	height: number;
}): Promise<string[]> {
	if (mediaAsset.type !== "video" || !mediaAsset.url) return [];

	const cacheKey = `${mediaAsset.id}-${numFrames}-${width}`;
	const cached = CACHE.get(cacheKey);
	if (cached) return cached;

	return new Promise((resolve) => {
		const video = document.createElement("video");
		video.crossOrigin = "anonymous";
		video.muted = true;
		video.preload = "auto";

		const timeout = setTimeout(() => {
			video.src = "";
			resolve([]);
		}, 10000);

		video.onloadedmetadata = () => {
			const duration = video.duration;
			if (!duration || !isFinite(duration)) {
				clearTimeout(timeout);
				resolve([]);
				return;
			}

			const frames: string[] = [];
			const interval = duration / numFrames;

			const captureFrame = (index: number) => {
				if (index >= numFrames) {
					clearTimeout(timeout);
					CACHE.set(cacheKey, frames);
					pruneCache();
					resolve(frames);
					return;
				}

				video.currentTime = interval * (index + 0.5);
			};

			video.onseeked = () => {
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					clearTimeout(timeout);
					resolve(frames);
					return;
				}
				ctx.drawImage(video, 0, 0, width, height);
				frames.push(canvas.toDataURL("image/jpeg", 0.4));
				captureFrame(frames.length);
			};

			captureFrame(0);
		};

		video.onerror = () => {
			clearTimeout(timeout);
			resolve([]);
		};

		video.src = mediaAsset.url ?? "";
	});
}

export function useFilmstrip({
	mediaAsset,
	clipDuration,
	visibleWidth,
	trackHeight,
}: {
	mediaAsset: MediaAsset | null;
	clipDuration: number;
	visibleWidth: number;
	trackHeight: number;
}): FilmstripState {
	const [state, setState] = useState<FilmstripState>({ thumbnails: [], loading: false });
	const abortRef = useRef(false);

	const generate = useCallback(async () => {
		if (!mediaAsset || mediaAsset.type !== "video" || clipDuration <= 0) {
			setState({ thumbnails: [], loading: false });
			return;
		}

		const thumbWidth = Math.max(40, Math.round(trackHeight * 16 / 9));
		const numFrames = Math.max(1, Math.min(20, Math.ceil(visibleWidth / thumbWidth)));

		setState({ thumbnails: [], loading: true });

		const thumbnails = await generateFilmstrip({
			mediaAsset,
			numFrames,
			width: thumbWidth,
			height: trackHeight,
		});

		if (!abortRef.current) {
			setState({ thumbnails, loading: false });
		}
	}, [mediaAsset?.id, clipDuration, visibleWidth, trackHeight]);

	useEffect(() => {
		abortRef.current = false;
		generate();
		return () => {
			abortRef.current = true;
		};
	}, [generate]);

	return state;
}
