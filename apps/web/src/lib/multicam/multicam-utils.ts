import { generateUUID } from "@/utils/id";
import type { TimelineTrack, TimelineElement, VideoElement } from "@/types/timeline";

export interface MulticamAngle {
	trackId: string;
	label: string;
	thumbnailUrl?: string;
}

export interface MulticamClip {
	id: string;
	angles: MulticamAngle[];
	syncOffset: number;
	activeAngleIndex: number;
	duration: number;
	startTime: number;
}

export function detectMulticamAngles(tracks: TimelineTrack[]): MulticamAngle[] {
	return tracks
		.filter((t) => t.type === "video")
		.map((t) => ({
			trackId: t.id,
			label: t.name || `Camera ${t.id.slice(0, 4)}`,
		}));
}

export function createMulticamClip({
	angles,
	startTime,
	duration,
}: {
	angles: MulticamAngle[];
	startTime: number;
	duration: number;
}): MulticamClip {
	return {
		id: generateUUID(),
		angles,
		syncOffset: 0,
		activeAngleIndex: 0,
		duration,
		startTime,
	};
}

export function switchAngle(
	clip: MulticamClip,
	angleIndex: number,
): MulticamClip {
	if (angleIndex < 0 || angleIndex >= clip.angles.length) return clip;
	return { ...clip, activeAngleIndex: angleIndex };
}

export function syncAnglesByTimecode(
	angles: MulticamAngle[],
	tracks: TimelineTrack[],
	referenceTime: number,
): MulticamAngle[] {
	return angles.map((angle) => {
		const track = tracks.find((t) => t.id === angle.trackId);
		if (!track) return angle;
		const firstElement = track.elements[0];
		if (!firstElement) return angle;
		return {
			...angle,
			syncOffset: firstElement.startTime - referenceTime,
		};
	});
}
