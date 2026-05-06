export interface AudioRecordingOptions {
	sampleRate: number;
	channelCount: number;
	monitoring: boolean;
	Countdown: number;
}

export const RECORDING_PRESETS = {
	studio: { sampleRate: 48000, channelCount: 1, label: "Studio (48kHz Mono)" },
	stereo: { sampleRate: 48000, channelCount: 2, label: "Stereo (48kHz Stereo)" },
	podcast: { sampleRate: 44100, channelCount: 1, label: "Podcast (44.1kHz Mono)" },
	voiceover: { sampleRate: 44100, channelCount: 1, label: "Voiceover (44.1kHz Mono)" },
} as const;
