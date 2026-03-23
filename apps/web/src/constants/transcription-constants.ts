import { LANGUAGES } from "@/constants/language-constants";
import type {
	TranscriptionModel,
	TranscriptionModelId,
} from "@/types/transcription";
import type { LanguageCode } from "@/types/language";

/** Languages supported by Whisper (local) transcription */
const WHISPER_TRANSCRIPTION_LANGS: ReadonlyArray<LanguageCode> = [
	"en",
	"es",
	"it",
	"fr",
	"de",
	"pt",
	"ru",
	"ja",
	"zh",
];

/** All languages supported for transcription (Whisper + Sarvam Indian languages) */
const SUPPORTED_TRANSCRIPTION_LANGS: ReadonlyArray<LanguageCode> = [
	...WHISPER_TRANSCRIPTION_LANGS,
	// Indian languages via Sarvam AI
	"hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "od",
	"as", "ur", "sa", "ne", "sd", "ks", "kok", "doi", "mai", "mni", "sat", "brx",
];

export const TRANSCRIPTION_LANGUAGES = LANGUAGES.filter((language) =>
	SUPPORTED_TRANSCRIPTION_LANGS.includes(language.code),
);

/** Whisper-only transcription languages (for the local engine dropdown) */
export const WHISPER_LANGUAGES = LANGUAGES.filter((language) =>
	WHISPER_TRANSCRIPTION_LANGS.includes(language.code),
);

export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
	{
		id: "whisper-tiny",
		name: "Tiny",
		huggingFaceId: "onnx-community/whisper-tiny",
		description: "Fastest, lower accuracy",
		engine: "whisper",
	},
	{
		id: "whisper-small",
		name: "Small",
		huggingFaceId: "onnx-community/whisper-small",
		description: "Good balance of speed and accuracy",
		engine: "whisper",
	},
	{
		id: "whisper-medium",
		name: "Medium",
		huggingFaceId: "onnx-community/whisper-medium",
		description: "Higher accuracy, slower",
		engine: "whisper",
	},
	{
		id: "whisper-large-v3-turbo",
		name: "Large v3 Turbo",
		huggingFaceId: "onnx-community/whisper-large-v3-turbo",
		description: "Best accuracy, requires WebGPU for good performance",
		engine: "whisper",
	},
	{
		id: "saaras-v3",
		name: "Sarvam Saaras v3",
		huggingFaceId: "",
		description: "Best for Indian regional languages (cloud, 22 languages)",
		engine: "sarvam",
	},
];

export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModelId =
	"whisper-small";

export const DEFAULT_CHUNK_LENGTH_SECONDS = 30;
export const DEFAULT_STRIDE_SECONDS = 5;

export const DEFAULT_WORDS_PER_CAPTION = 3;
export const MIN_CAPTION_DURATION_SECONDS = 0.8;
