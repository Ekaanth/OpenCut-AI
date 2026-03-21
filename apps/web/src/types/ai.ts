// Transcription types
export interface TranscriptionWord {
	word: string;
	start: number;
	end: number;
	confidence: number;
}

export interface TranscriptionSegment {
	id: number;
	text: string;
	start: number;
	end: number;
	words: TranscriptionWord[];
	speaker?: string;
}

export interface TranscriptionResult {
	segments: TranscriptionSegment[];
	language: string;
	duration: number;
}

// Image generation
export interface ImageGenParams {
	prompt: string;
	negativePrompt?: string;
	width: number;
	height: number;
	steps: number;
	guidanceScale: number;
	model?: string;
}

export interface ImageGenResult {
	imageUrl: string;
	seed: number;
	prompt: string;
}

// LLM Command types
export type EditorActionType =
	| "REMOVE_SEGMENTS"
	| "ADD_SUBTITLE_TRACK"
	| "ADD_IMAGE_OVERLAY"
	| "TRIM_CLIP"
	| "ADD_TRANSITION"
	| "SPLIT_CLIP"
	| "ADD_TEXT_OVERLAY"
	| "ADJUST_SPEED"
	| "ADD_VOICEOVER"
	| "REMOVE_SILENCE"
	| "REMOVE_FILLERS"
	| "ADD_CHAPTER_MARKERS"
	| "DENOISE_AUDIO"
	| "GENERATE_IMAGE";

export interface EditorAction {
	type: EditorActionType;
	params: Record<string, unknown>;
	description: string;
}

export interface CommandResult {
	actions: EditorAction[];
	explanation: string;
	needsClarification?: boolean;
	clarificationQuestion?: string;
}

// TTS types
export interface TTSRequest {
	text: string;
	language: string;
	speakerWav?: string;
	speaker?: string;
}

export interface TTSResult {
	audioUrl: string;
	duration: number;
}

// Audio types
export interface DenoiseRequest {
	strength: number;
}

export interface DenoiseResult {
	audioUrl: string;
	originalUrl: string;
}

// Silence detection
export interface SilenceRegion {
	start: number;
	end: number;
	duration: number;
}

// Filler detection
export interface FillerWord {
	word: string;
	start: number;
	end: number;
	segmentIndex: number;
	wordIndex: number;
	isFiller: boolean;
}

// Chapter detection
export interface Chapter {
	title: string;
	start: number;
	end: number;
	summary?: string;
}

export interface StructureAnalysis {
	chapters: Chapter[];
	highlights: { start: number; end: number; reason: string }[];
	suggestedTitle?: string;
	suggestedDescription?: string;
}

// Suggestion types
export interface AISuggestion {
	id: string;
	type: "warning" | "improvement" | "info";
	message: string;
	action?: EditorAction;
	dismissed: boolean;
}

// AI Backend status
export interface AIBackendStatus {
	available: boolean;
	models: string[];
	gpuAvailable: boolean;
	memoryUsage?: {
		ram?: { usedMb: number; totalMb: number; percent: number };
		gpu?: { usedMb: number; totalMb: number };
	};
	error?: string;
	errorType?: AIErrorType;
}

export type AIErrorType =
	| "connection_refused"
	| "timeout"
	| "backend_error"
	| "network_error"
	| "unknown";

// Infographic types
export interface InfographicTemplate {
	id: string;
	name: string;
	category:
		| "lower-third"
		| "stat-callout"
		| "comparison"
		| "step-flow"
		| "quote-card"
		| "list-overlay"
		| "progress-bar";
	thumbnail: string;
}

export interface InfographicData {
	template: string;
	content: Record<string, string | number>;
	style: {
		primaryColor: string;
		secondaryColor: string;
		fontFamily: string;
		fontSize: number;
		animation: "none" | "fade" | "slide" | "bounce";
	};
	position: { x: number; y: number };
	duration: number;
}

// Subtitle styles
export type SubtitlePreset = "captions" | "classic" | "modern" | "karaoke";

export interface SubtitleStyle {
	preset: SubtitlePreset;
	fontFamily: string;
	fontSize: number;
	fontColor: string;
	backgroundColor: string;
	outlineColor: string;
	outlineWidth: number;
	position: "top" | "center" | "bottom";
	animation: "none" | "word-highlight" | "karaoke-fill" | "bounce-in";
}

// Model management
export interface ModelInfo {
	name: string;
	size: string;
	installed: boolean;
	downloading: boolean;
	progress: number;
}

export interface ModelTier {
	name: "lite" | "standard" | "full";
	label: string;
	description: string;
	totalSize: string;
	models: ModelInfo[];
}
