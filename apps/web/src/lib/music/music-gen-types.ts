export interface MusicGenParams {
	prompt: string;
	genre: string;
	mood: string;
	tempo: "slow" | "medium" | "fast";
	duration: number;
	instrumental: boolean;
}

export interface MusicGenResult {
	audioUrl: string;
	duration: number;
	waveformPeaks: number[];
	title: string;
}

export const MUSIC_GENRES = [
	"Cinematic",
	"Electronic",
	"Lo-fi Hip Hop",
	"Ambient",
	"Acoustic",
	"Pop",
	"Rock",
	"Jazz",
	"Classical",
	"R&B",
	"Folk",
	"Synthwave",
	"Trap",
	"Drum & Bass",
	"Chillout",
] as const;

export const MUSIC_MOODS = [
	"Happy",
	"Sad",
	"Energetic",
	"Calm",
	"Dramatic",
	"Mysterious",
	"Romantic",
	"Epic",
	"Playful",
	"Dark",
	"Uplifting",
	"Nostalgic",
] as const;

export const MUSIC_TEMPOS = {
	slow: { label: "Slow", bpm: "60-80" },
	medium: { label: "Medium", bpm: "80-120" },
	fast: { label: "Fast", bpm: "120-160" },
} as const;

export const DEFAULT_MUSIC_PARAMS: MusicGenParams = {
	prompt: "",
	genre: "Lo-fi Hip Hop",
	mood: "Calm",
	tempo: "medium",
	duration: 30,
	instrumental: true,
};
