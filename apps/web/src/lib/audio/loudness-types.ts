export interface LUFSMeasurement {
	integrated: number;
	shortTerm: number;
	momentary: number;
	truePeak: number;
	range: number;
}

export interface NormalizationConfig {
	targetLUFS: number;
	truePeakLimit: number;
	mode: "integrated" | "short-term" | "momentary";
}

export const LOUDNESS_PRESETS = [
	{ label: "YouTube", targetLUFS: -14, truePeakLimit: -1, desc: "YouTube standard" },
	{ label: "Spotify", targetLUFS: -14, truePeakLimit: -1, desc: "Spotify standard" },
	{ label: "Apple Podcasts", targetLUFS: -16, truePeakLimit: -1, desc: "Apple standard" },
	{ label: "Broadcast (EBU R128)", targetLUFS: -23, truePeakLimit: -1, desc: "EU broadcast" },
	{ label: "Broadcast (ATSC A/85)", targetLUFS: -24, truePeakLimit: -2, desc: "US broadcast" },
	{ label: "Streaming General", targetLUFS: -16, truePeakLimit: -1, desc: "General streaming" },
	{ label: "Custom", targetLUFS: -16, truePeakLimit: -1, desc: "Custom target" },
] as const;

export const DEFAULT_NORMALIZATION: NormalizationConfig = {
	targetLUFS: -14,
	truePeakLimit: -1,
	mode: "integrated",
};
