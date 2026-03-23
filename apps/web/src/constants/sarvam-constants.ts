/**
 * Sarvam AI constants — language codes, models, speakers, and feature mappings.
 *
 * Sarvam uses BCP-47-style codes with `-IN` suffix (e.g. "hi-IN").
 * This file maps between OpenCut's short codes and Sarvam's codes.
 */

// ---------------------------------------------------------------------------
// Language code mapping: OpenCut short code → Sarvam BCP-47 code
// ---------------------------------------------------------------------------

export const SARVAM_LANGUAGE_MAP: Record<string, string> = {
	hi: "hi-IN",
	bn: "bn-IN",
	ta: "ta-IN",
	te: "te-IN",
	mr: "mr-IN",
	gu: "gu-IN",
	kn: "kn-IN",
	ml: "ml-IN",
	pa: "pa-IN",
	od: "od-IN",
	as: "as-IN",
	ur: "ur-IN",
	sa: "sa-IN",
	ne: "ne-IN",
	sd: "sd-IN",
	ks: "ks-IN",
	kok: "kok-IN",
	doi: "doi-IN",
	mai: "mai-IN",
	mni: "mni-IN",
	sat: "sat-IN",
	brx: "brx-IN",
	en: "en-IN",
};

/** Reverse map: Sarvam code → OpenCut short code */
export const SARVAM_CODE_TO_SHORT: Record<string, string> = Object.fromEntries(
	Object.entries(SARVAM_LANGUAGE_MAP).map(([k, v]) => [v, k]),
);

// ---------------------------------------------------------------------------
// Languages supported per Sarvam service
// ---------------------------------------------------------------------------

/** All 23 languages supported by Sarvam STT (Saaras v3) and sarvam-translate */
export const SARVAM_STT_LANGUAGES = [
	{ code: "hi", name: "Hindi", sarvamCode: "hi-IN" },
	{ code: "bn", name: "Bengali", sarvamCode: "bn-IN" },
	{ code: "ta", name: "Tamil", sarvamCode: "ta-IN" },
	{ code: "te", name: "Telugu", sarvamCode: "te-IN" },
	{ code: "mr", name: "Marathi", sarvamCode: "mr-IN" },
	{ code: "gu", name: "Gujarati", sarvamCode: "gu-IN" },
	{ code: "kn", name: "Kannada", sarvamCode: "kn-IN" },
	{ code: "ml", name: "Malayalam", sarvamCode: "ml-IN" },
	{ code: "pa", name: "Punjabi", sarvamCode: "pa-IN" },
	{ code: "od", name: "Odia", sarvamCode: "od-IN" },
	{ code: "as", name: "Assamese", sarvamCode: "as-IN" },
	{ code: "ur", name: "Urdu", sarvamCode: "ur-IN" },
	{ code: "sa", name: "Sanskrit", sarvamCode: "sa-IN" },
	{ code: "ne", name: "Nepali", sarvamCode: "ne-IN" },
	{ code: "sd", name: "Sindhi", sarvamCode: "sd-IN" },
	{ code: "ks", name: "Kashmiri", sarvamCode: "ks-IN" },
	{ code: "kok", name: "Konkani", sarvamCode: "kok-IN" },
	{ code: "doi", name: "Dogri", sarvamCode: "doi-IN" },
	{ code: "mai", name: "Maithili", sarvamCode: "mai-IN" },
	{ code: "mni", name: "Manipuri", sarvamCode: "mni-IN" },
	{ code: "sat", name: "Santali", sarvamCode: "sat-IN" },
	{ code: "brx", name: "Bodo", sarvamCode: "brx-IN" },
	{ code: "en", name: "English (Indian)", sarvamCode: "en-IN" },
] as const;

/** 11 languages supported by Sarvam TTS (Bulbul v3), Mayura translation, and transliteration */
export const SARVAM_TTS_LANGUAGES = [
	{ code: "hi", name: "Hindi", sarvamCode: "hi-IN" },
	{ code: "bn", name: "Bengali", sarvamCode: "bn-IN" },
	{ code: "ta", name: "Tamil", sarvamCode: "ta-IN" },
	{ code: "te", name: "Telugu", sarvamCode: "te-IN" },
	{ code: "mr", name: "Marathi", sarvamCode: "mr-IN" },
	{ code: "gu", name: "Gujarati", sarvamCode: "gu-IN" },
	{ code: "kn", name: "Kannada", sarvamCode: "kn-IN" },
	{ code: "ml", name: "Malayalam", sarvamCode: "ml-IN" },
	{ code: "pa", name: "Punjabi", sarvamCode: "pa-IN" },
	{ code: "od", name: "Odia", sarvamCode: "od-IN" },
	{ code: "en", name: "English (Indian)", sarvamCode: "en-IN" },
] as const;

/** Short codes of all Sarvam-supported languages for quick membership checks */
export const SARVAM_SUPPORTED_CODES: Set<string> = new Set(
	SARVAM_STT_LANGUAGES.map((l) => l.code),
);

/** Short codes of Sarvam TTS-supported languages */
export const SARVAM_TTS_SUPPORTED_CODES: Set<string> = new Set(
	SARVAM_TTS_LANGUAGES.map((l) => l.code),
);

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const SARVAM_STT_MODEL = "saaras:v3";
export const SARVAM_TRANSLATE_MODEL = "sarvam-translate:v1";
export const SARVAM_TRANSLATE_MODEL_LITE = "mayura:v1";
export const SARVAM_TTS_MODEL = "bulbul:v3";

// ---------------------------------------------------------------------------
// STT modes
// ---------------------------------------------------------------------------

export const SARVAM_STT_MODES = [
	{ value: "transcribe", label: "Transcribe", description: "Transcribe in original language" },
	{ value: "translate", label: "Translate to English", description: "Transcribe and translate to English" },
] as const;

// ---------------------------------------------------------------------------
// TTS speakers (Bulbul v3)
// ---------------------------------------------------------------------------

export const SARVAM_TTS_SPEAKERS = [
	{ id: "shubh", name: "Shubh", gender: "male" },
	{ id: "aditya", name: "Aditya", gender: "male" },
	{ id: "ritu", name: "Ritu", gender: "female" },
	{ id: "priya", name: "Priya", gender: "female" },
	{ id: "neha", name: "Neha", gender: "female" },
	{ id: "rahul", name: "Rahul", gender: "male" },
	{ id: "pooja", name: "Pooja", gender: "female" },
	{ id: "rohan", name: "Rohan", gender: "male" },
	{ id: "simran", name: "Simran", gender: "female" },
	{ id: "kavya", name: "Kavya", gender: "female" },
	{ id: "amit", name: "Amit", gender: "male" },
	{ id: "dev", name: "Dev", gender: "male" },
	{ id: "ishita", name: "Ishita", gender: "female" },
	{ id: "shreya", name: "Shreya", gender: "female" },
	{ id: "ratan", name: "Ratan", gender: "male" },
	{ id: "varun", name: "Varun", gender: "male" },
	{ id: "anand", name: "Anand", gender: "male" },
	{ id: "tanya", name: "Tanya", gender: "female" },
	{ id: "tarun", name: "Tarun", gender: "male" },
	{ id: "sunny", name: "Sunny", gender: "male" },
	{ id: "kavitha", name: "Kavitha", gender: "female" },
	{ id: "vijay", name: "Vijay", gender: "male" },
	{ id: "shruti", name: "Shruti", gender: "female" },
] as const;

export const SARVAM_DEFAULT_SPEAKER = "shubh";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an OpenCut language code to Sarvam code. Returns undefined if not supported. */
export function toSarvamCode(code: string): string | undefined {
	return SARVAM_LANGUAGE_MAP[code];
}

/** Check if a language code is supported by Sarvam STT */
export function isSarvamSTTSupported(code: string): boolean {
	return SARVAM_SUPPORTED_CODES.has(code);
}

/** Check if a language code is supported by Sarvam TTS */
export function isSarvamTTSSupported(code: string): boolean {
	return SARVAM_TTS_SUPPORTED_CODES.has(code);
}
