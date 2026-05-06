export interface BeatMarker {
	time: number;
	strength: number;
	index: number;
}

export interface BeatDetectionResult {
	bpm: number;
	beats: BeatMarker[];
	confidence: number;
}

export interface BeatGridConfig {
	snapToBeats: boolean;
	gridSubdivision: 1 | 2 | 4;
	showGrid: boolean;
	gridColor: string;
}

export const DEFAULT_BEAT_GRID: BeatGridConfig = {
	snapToBeats: false,
	gridSubdivision: 1,
	showGrid: true,
	gridColor: "#8b5cf6",
};
