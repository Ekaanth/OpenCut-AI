/**
 * Languages supported by the local NLLB-200 translate-service.
 *
 * Single source of truth shared by AI Dubbing, Multilingual Captions, and any
 * future consumer. The ISO 639-1 codes here map 1:1 to the FLORES-200 codes
 * in `services/ai-backend/app/routes/translate.py` (ISO_TO_FLORES) — keep both
 * lists in sync when adding a language.
 *
 * `tts` flags whether XTTS v2 can synthesize the language (for dubbing).
 * Captions don't care about `tts` — only translation matters there.
 */

export interface NLLBLanguage {
	code: string;
	name: string;
	native: string;
	/** Whether XTTS v2 supports this language for voice-cloned speech. */
	tts: boolean;
}

export const NLLB_LANGUAGES: readonly NLLBLanguage[] = [
	{ code: "en", name: "English", native: "English", tts: true },
	{ code: "es", name: "Spanish", native: "Español", tts: true },
	{ code: "fr", name: "French", native: "Français", tts: true },
	{ code: "de", name: "German", native: "Deutsch", tts: true },
	{ code: "it", name: "Italian", native: "Italiano", tts: true },
	{ code: "pt", name: "Portuguese", native: "Português", tts: true },
	{ code: "pl", name: "Polish", native: "Polski", tts: true },
	{ code: "tr", name: "Turkish", native: "Türkçe", tts: true },
	{ code: "ru", name: "Russian", native: "Русский", tts: true },
	{ code: "nl", name: "Dutch", native: "Nederlands", tts: true },
	{ code: "cs", name: "Czech", native: "Čeština", tts: true },
	{ code: "ar", name: "Arabic", native: "العربية", tts: true },
	{ code: "zh", name: "Chinese", native: "中文", tts: true },
	{ code: "ja", name: "Japanese", native: "日本語", tts: true },
	{ code: "ko", name: "Korean", native: "한국어", tts: true },
	{ code: "hi", name: "Hindi", native: "हिन्दी", tts: true },
	{ code: "hu", name: "Hungarian", native: "Magyar", tts: true },
] as const;

/** Look up a language by ISO 639-1 code. */
export function getNLLBLanguage(code: string): NLLBLanguage | undefined {
	return NLLB_LANGUAGES.find((l) => l.code === code);
}

/** Human-readable name for a code, falling back to the code itself. */
export function nllbLanguageName(code: string): string {
	return getNLLBLanguage(code)?.name ?? code;
}
