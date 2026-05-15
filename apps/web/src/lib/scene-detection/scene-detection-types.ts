export interface SceneChange {
	time: number;
	confidence: number;
	type: "cut" | "dissolve" | "unknown";
	frameBefore?: string;
	frameAfter?: string;
	index: number;
}

export interface SceneDetectionOptions {
	sampleInterval: number;
	threshold: number;
	maxFrames: number;
	captureThumbnails: boolean;
	thumbnailWidth: number;
}

export const DEFAULT_SCENE_OPTIONS: SceneDetectionOptions = {
	sampleInterval: 0.5,
	threshold: 0.35,
	maxFrames: 600,
	captureThumbnails: true,
	thumbnailWidth: 80,
};
