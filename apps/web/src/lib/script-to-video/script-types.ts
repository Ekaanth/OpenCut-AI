export interface ScriptSection {
	id: string;
	type: "narration" | "visual" | "title" | "transition" | "music" | "sfx";
	text: string;
	duration: number;
	prompt?: string;
	style?: string;
}

export interface ScriptToVideoConfig {
	aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
	voiceId: string;
	language: string;
	style: "documentary" | "explainer" | "social" | "cinematic" | "tutorial";
	includeMusic: boolean;
	includeSubtitles: boolean;
	transitionStyle: "cut" | "dissolve" | "slide" | "zoom";
}

export const SCRIPT_STYLES = [
	{ value: "documentary", label: "Documentary" },
	{ value: "explainer", label: "Explainer" },
	{ value: "social", label: "Social Media" },
	{ value: "cinematic", label: "Cinematic" },
	{ value: "tutorial", label: "Tutorial" },
] as const;

export const DEFAULT_SCRIPT_CONFIG: ScriptToVideoConfig = {
	aspectRatio: "16:9",
	voiceId: "default",
	language: "en",
	style: "explainer",
	includeMusic: true,
	includeSubtitles: true,
	transitionStyle: "dissolve",
};
