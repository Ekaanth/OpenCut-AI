/**
 * Smallest AI (Waves) constants — voices, languages, and models.
 *
 * Lightning v3.1 TTS: 15 languages, 80+ voices, ~100ms latency, 44.1 kHz
 * Pulse STT: 39 languages, speaker diarization, emotion detection
 */

// ---------------------------------------------------------------------------
// TTS Languages (Lightning v3.1)
// ---------------------------------------------------------------------------

export const SMALLEST_TTS_LANGUAGES = [
	{ code: "en", name: "English", status: "stable" as const },
	{ code: "hi", name: "Hindi", status: "stable" as const },
	{ code: "es", name: "Spanish", status: "stable" as const },
	{ code: "ta", name: "Tamil", status: "stable" as const },
	{ code: "kn", name: "Kannada", status: "stable" as const },
	{ code: "te", name: "Telugu", status: "stable" as const },
	{ code: "ml", name: "Malayalam", status: "stable" as const },
	{ code: "mr", name: "Marathi", status: "stable" as const },
	{ code: "gu", name: "Gujarati", status: "stable" as const },
	{ code: "fr", name: "French", status: "beta" as const },
	{ code: "it", name: "Italian", status: "beta" as const },
	{ code: "nl", name: "Dutch", status: "beta" as const },
	{ code: "sv", name: "Swedish", status: "beta" as const },
	{ code: "pt", name: "Portuguese", status: "beta" as const },
	{ code: "de", name: "German", status: "beta" as const },
] as const;

// ---------------------------------------------------------------------------
// STT Languages (Pulse — 32+ languages, common ones listed)
// ---------------------------------------------------------------------------

export const SMALLEST_STT_LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "hi", name: "Hindi" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "it", name: "Italian" },
	{ code: "pt", name: "Portuguese" },
	{ code: "nl", name: "Dutch" },
	{ code: "sv", name: "Swedish" },
	{ code: "ta", name: "Tamil" },
	{ code: "te", name: "Telugu" },
	{ code: "kn", name: "Kannada" },
	{ code: "ml", name: "Malayalam" },
	{ code: "mr", name: "Marathi" },
	{ code: "gu", name: "Gujarati" },
	{ code: "bn", name: "Bengali" },
	{ code: "pa", name: "Punjabi" },
	{ code: "ur", name: "Urdu" },
	{ code: "ja", name: "Japanese" },
	{ code: "ko", name: "Korean" },
	{ code: "zh", name: "Chinese" },
	{ code: "ar", name: "Arabic" },
	{ code: "ru", name: "Russian" },
	{ code: "tr", name: "Turkish" },
	{ code: "pl", name: "Polish" },
	{ code: "uk", name: "Ukrainian" },
	{ code: "th", name: "Thai" },
	{ code: "vi", name: "Vietnamese" },
	{ code: "id", name: "Indonesian" },
	{ code: "ms", name: "Malay" },
] as const;

// ---------------------------------------------------------------------------
// Voices (Lightning v3.1)
// ---------------------------------------------------------------------------

export const SMALLEST_TTS_VOICES = [
	// English (US)
	{ id: "emily", name: "Emily", language: "en", gender: "female" as const },
	{ id: "jasmine", name: "Jasmine", language: "en", gender: "female" as const },
	{ id: "arman", name: "Arman", language: "en", gender: "male" as const },
	{ id: "quinn", name: "Quinn", language: "en", gender: "female" as const },
	{ id: "mia", name: "Mia", language: "en", gender: "female" as const },
	{ id: "magnus", name: "Magnus", language: "en", gender: "male" as const },
	{ id: "olivia", name: "Olivia", language: "en", gender: "female" as const },
	{ id: "daniel", name: "Daniel", language: "en", gender: "male" as const },
	{ id: "rachel", name: "Rachel", language: "en", gender: "female" as const },
	{ id: "nicole", name: "Nicole", language: "en", gender: "female" as const },
	{ id: "elizabeth", name: "Elizabeth", language: "en", gender: "female" as const },
	// Hindi / English
	{ id: "neel", name: "Neel", language: "hi", gender: "male" as const },
	{ id: "maithili", name: "Maithili", language: "hi", gender: "female" as const },
	{ id: "devansh", name: "Devansh", language: "hi", gender: "male" as const },
	{ id: "sameera", name: "Sameera", language: "hi", gender: "female" as const },
	{ id: "mihir", name: "Mihir", language: "hi", gender: "male" as const },
	{ id: "aarush", name: "Aarush", language: "hi", gender: "male" as const },
	{ id: "sakshi", name: "Sakshi", language: "hi", gender: "female" as const },
	{ id: "vivaan", name: "Vivaan", language: "hi", gender: "male" as const },
	{ id: "srishti", name: "Srishti", language: "hi", gender: "female" as const },
	// Spanish
	{ id: "daniella", name: "Daniella", language: "es", gender: "female" as const },
	{ id: "sandra", name: "Sandra", language: "es", gender: "female" as const },
	{ id: "carlos", name: "Carlos", language: "es", gender: "male" as const },
	{ id: "jose", name: "Jose", language: "es", gender: "male" as const },
	{ id: "luis", name: "Luis", language: "es", gender: "male" as const },
	{ id: "mariana", name: "Mariana", language: "es", gender: "female" as const },
	{ id: "miguel", name: "Miguel", language: "es", gender: "male" as const },
	// Tamil
	{ id: "tamil_male_1", name: "Tamil Male", language: "ta", gender: "male" as const },
	{ id: "tamil_female_1", name: "Tamil Female", language: "ta", gender: "female" as const },
	// Telugu
	{ id: "telugu_male_1", name: "Telugu Male", language: "te", gender: "male" as const },
	{ id: "telugu_female_1", name: "Telugu Female", language: "te", gender: "female" as const },
	// Malayalam
	{ id: "malayalam_male_1", name: "Malayalam Male", language: "ml", gender: "male" as const },
	{ id: "malayalam_female_1", name: "Malayalam Female", language: "ml", gender: "female" as const },
	// Marathi
	{ id: "marathi_male_1", name: "Marathi Male", language: "mr", gender: "male" as const },
	{ id: "marathi_female_1", name: "Marathi Female", language: "mr", gender: "female" as const },
	// Gujarati
	{ id: "gujarati_male_1", name: "Gujarati Male", language: "gu", gender: "male" as const },
	{ id: "gujarati_female_1", name: "Gujarati Female", language: "gu", gender: "female" as const },
	// Kannada
	{ id: "kannada_male_1", name: "Kannada Male", language: "kn", gender: "male" as const },
	{ id: "kannada_female_1", name: "Kannada Female", language: "kn", gender: "female" as const },
] as const;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const SMALLEST_DEFAULT_VOICE = "emily";
export const SMALLEST_DEFAULT_LANGUAGE = "en";
export const SMALLEST_TTS_MODEL = "lightning-v3.1";
export const SMALLEST_STT_MODEL = "pulse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get voices filtered by language code */
export function getSmallestVoicesForLanguage(languageCode: string) {
	return SMALLEST_TTS_VOICES.filter((v) => v.language === languageCode);
}

/** Check if a language code is supported by Smallest TTS */
export function isSmallestTTSSupported(code: string): boolean {
	return SMALLEST_TTS_LANGUAGES.some((l) => l.code === code);
}

/** Check if a language code is supported by Smallest STT */
export function isSmallestSTTSupported(code: string): boolean {
	return SMALLEST_STT_LANGUAGES.some((l) => l.code === code);
}
