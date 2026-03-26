import type { LanguageCode } from "./language";

export type TranscriptionLanguage = LanguageCode | "auto";

/** Engine used for transcription: local Whisper, cloud Sarvam AI, or cloud Smallest AI */
export type TranscriptionEngine = "whisper" | "sarvam" | "smallest";

/** Sarvam STT modes */
export type SarvamSTTMode = "transcribe" | "translate";

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
}

export interface TranscriptionResult {
	text: string;
	segments: TranscriptionSegment[];
	language: string;
}

export type TranscriptionStatus =
	| "idle"
	| "loading-model"
	| "transcribing"
	| "complete"
	| "error";

export interface TranscriptionProgress {
	status: TranscriptionStatus;
	progress: number;
	message?: string;
}

export type TranscriptionModelId =
	| "whisper-tiny"
	| "whisper-small"
	| "whisper-medium"
	| "whisper-large-v3-turbo"
	| "saaras-v3"
	| "pulse-v1";

export interface TranscriptionModel {
	id: TranscriptionModelId;
	name: string;
	huggingFaceId: string;
	description: string;
	engine: TranscriptionEngine;
}

export interface CaptionChunk {
	text: string;
	startTime: number;
	duration: number;
}

/** Sarvam translation request */
export interface SarvamTranslateRequest {
	text: string;
	sourceLanguageCode: string;
	targetLanguageCode: string;
	model?: string;
	mode?: "formal" | "modern-colloquial" | "classic-colloquial";
}

/** Sarvam TTS request */
export interface SarvamTTSRequest {
	text: string;
	targetLanguageCode: string;
	speaker?: string;
	model?: string;
	pace?: number;
	sampleRate?: number;
}

/** Sarvam TTS response */
export interface SarvamTTSResult {
	audioBase64: string;
	requestId: string;
}
