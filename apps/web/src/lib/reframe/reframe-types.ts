import type { FaceDetectionResult, FaceFrame } from "@/types/ai";
import type { NumberKeyframe } from "@/types/animation";

export type ReframeAspectRatio = "9:16" | "1:1" | "4:5" | "16:9" | "custom";

export interface ReframePreset {
	id: string;
	name: string;
	aspectRatio: ReframeAspectRatio;
	width: number;
	height: number;
	label: string;
}

export const REFRAME_PRESETS: ReframePreset[] = [
	{ id: "tiktok", name: "TikTok / Reels", aspectRatio: "9:16", width: 1080, height: 1920, label: "9:16" },
	{ id: "square", name: "Square", aspectRatio: "1:1", width: 1080, height: 1080, label: "1:1" },
	{ id: "instagram-portrait", name: "Instagram Portrait", aspectRatio: "4:5", width: 1080, height: 1350, label: "4:5" },
	{ id: "youtube", name: "YouTube", aspectRatio: "16:9", width: 1920, height: 1080, label: "16:9" },
];

export interface ReframeOptions {
	targetWidth: number;
	targetHeight: number;
	smoothingWindow: number;
	minConfidence: number;
	padding: number;
}

export interface ReframeKeyframes {
	positionX: NumberKeyframe[];
	positionY: NumberKeyframe[];
	scale: NumberKeyframe[];
}

export interface ReframeResult {
	keyframes: ReframeKeyframes;
	preset: ReframePreset;
	detectionResult: FaceDetectionResult;
	framesAnalyzed: number;
}

export function getDefaultReframeOptions(): ReframeOptions {
	return {
		targetWidth: 1080,
		targetHeight: 1920,
		smoothingWindow: 0.5,
		minConfidence: 0.5,
		padding: 0.15,
	};
}

export function computeReframeKeyframes(
	detection: FaceDetectionResult,
	options: ReframeOptions,
): ReframeKeyframes {
	const { frames, video_width: vw, video_height: vh } = detection;
	if (vw === 0 || vh === 0) {
		return { positionX: [], positionY: [], scale: [] };
	}

	const targetAspect = options.targetWidth / options.targetHeight;
	const sourceAspect = vw / vh;

	const isCropNeeded = Math.abs(targetAspect - sourceAspect) > 0.01;

	if (!isCropNeeded || frames.length === 0) {
		return {
			positionX: [{ id: "rx-0", time: 0, value: 0, interpolation: "linear" }],
			positionY: [{ id: "ry-0", time: 0, value: 0, interpolation: "linear" }],
			scale: [{ id: "rs-0", time: 0, value: 1, interpolation: "linear" }],
		};
	}

	const rawCenters: { time: number; cx: number; cy: number }[] = [];

	for (const frame of frames) {
		const primary = selectPrimaryFace(frame, options.minConfidence);
		if (!primary) continue;

		const cx = primary.x + primary.width / 2;
		const cy = primary.y + primary.height / 2;

		rawCenters.push({ time: frame.timestamp, cx, cy });
	}

	if (rawCenters.length === 0) {
		return {
			positionX: [{ id: "rx-0", time: 0, value: 0, interpolation: "linear" }],
			positionY: [{ id: "ry-0", time: 0, value: 0, interpolation: "linear" }],
			scale: [{ id: "rs-0", time: 0, value: 1, interpolation: "linear" }],
		};
	}

	const smoothed = smoothCenters(rawCenters, options.smoothingWindow);

	const positionX: NumberKeyframe[] = [];
	const positionY: NumberKeyframe[] = [];
	const scale: NumberKeyframe[] = [];

	for (let i = 0; i < smoothed.length; i++) {
		const { time, cx, cy } = smoothed[i];

		const offsetX = reframeOffset(cx, 0.5, targetAspect, sourceAspect, options.padding);
		const offsetY = reframeOffset(cy, 0.5, 1, 1, options.padding);

		positionX.push({
			id: `rx-${i}`,
			time,
			value: clamp(offsetX * vw, -vw * 0.5, vw * 0.5),
			interpolation: "linear",
		});
		positionY.push({
			id: `ry-${i}`,
			time,
			value: clamp(offsetY * vh, -vh * 0.5, vh * 0.5),
			interpolation: "linear",
		});
	}

	const cropScale = targetAspect > sourceAspect
		? sourceAspect / targetAspect
		: targetAspect / sourceAspect;

	const fitScale = 1 / cropScale;

	scale.push({
		id: "rs-0",
		time: 0,
		value: fitScale,
		interpolation: "linear",
	});

	return { positionX, positionY, scale };
}

function selectPrimaryFace(
	frame: FaceFrame,
	minConfidence: number,
): { x: number; y: number; width: number; height: number } | null {
	const valid = frame.faces.filter((f) => f.confidence >= minConfidence);
	if (valid.length === 0) return null;

	valid.sort((a, b) => {
		const areaA = a.width * a.height;
		const areaB = b.width * b.height;
		return areaB - areaA;
	});

	return valid[0];
}

function smoothCenters(
	centers: { time: number; cx: number; cy: number }[],
	windowSec: number,
): { time: number; cx: number; cy: number }[] {
	if (centers.length <= 2) return centers;

	const result: { time: number; cx: number; cy: number }[] = [];

	for (let i = 0; i < centers.length; i++) {
		let sumCx = 0;
		let sumCy = 0;
		let count = 0;

		for (let j = 0; j < centers.length; j++) {
			if (Math.abs(centers[j].time - centers[i].time) <= windowSec) {
				sumCx += centers[j].cx;
				sumCy += centers[j].cy;
				count++;
			}
		}

		result.push({
			time: centers[i].time,
			cx: sumCx / count,
			cy: sumCy / count,
		});
	}

	return result;
}

function reframeOffset(
	center: number,
	defaultCenter: number,
	targetAspect: number,
	sourceAspect: number,
	padding: number,
): number {
	const usableRange = 1 - padding * 2;
	const offset = center - defaultCenter;
	return clamp(offset * usableRange, -0.5, 0.5);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
