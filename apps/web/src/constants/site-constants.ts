
export const SITE_URL = "https://opencut.app";

export const SITE_INFO = {
	title: "OpenCut AI",
	description:
		"A fork of OpenCut with AI superpowers added on top. Transcribe, generate, edit by text, and clone voices. Install locally and run everything on your machine.",
	url: SITE_URL,
	openGraphImage: "/open-graph/default.jpg",
	twitterImage: "/open-graph/default.jpg",
	favicon: "/favicon.svg",
};

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	logo: string;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [
	{
		name: "Claude (Opus 4.6)",
		description: "Anthropic's most capable model. Used to build the entire AI layer of OpenCut AI.",
		url: "https://claude.ai",
		logo: "/logos/tools/claude.png",
	},
	{
		name: "Cursor",
		description: "AI-powered code editor. The IDE used to develop OpenCut AI with Claude integration.",
		url: "https://cursor.com",
		logo: "/logos/tools/cursor.png",
	},
	{
		name: "Docker",
		description: "Container platform running all AI services locally. Whisper, TTS, Ollama, and more.",
		url: "https://docker.com",
		logo: "/logos/tools/docker.png",
	},
	{
		name: "Ollama",
		description: "Run LLMs locally. Powers AI commands, fact-checking, script editing, and translation.",
		url: "https://ollama.com",
		logo: "/logos/tools/ollama.png",
	},
	{
		name: "Coqui TTS",
		description: "Open-source text-to-speech with voice cloning. XTTS v2 model for natural voiceovers.",
		url: "https://github.com/idiap/coqui-ai-TTS",
		logo: "/logos/tools/coqui.png",
	},
	{
		name: "Faster Whisper",
		description: "CTranslate2 reimplementation of Whisper. Fast, accurate local transcription.",
		url: "https://github.com/SYSTRAN/faster-whisper",
		logo: "/logos/tools/whisper.png",
	},
];

export const DEFAULT_LOGO_URL = "/logos/opencut/svg/logo.svg";

export const SOCIAL_LINKS = {
	x: "https://x.com/humblefool",
	github: "https://github.com/Ekaanth/OpenCut-AI",
};

/** Link back to the upstream project we forked from */
export const UPSTREAM_URL = "https://github.com/OpenCut-app/OpenCut";

export type Sponsor = {
	name: string;
	url: string;
	logo: string;
	description: string;
	invertOnDark?: boolean;
};

export const SPONSORS: Sponsor[] = [
	{
		name: "Fal.ai",
		url: "https://fal.ai?utm_source=opencut",
		logo: "/logos/others/fal.svg",
		description: "Generative image, video, and audio models all in one place.",
		invertOnDark: true,
	},
	{
		name: "Vercel",
		url: "https://vercel.com?utm_source=opencut",
		logo: "/logos/others/vercel.svg",
		description: "Platform where we deploy and host the editor.",
		invertOnDark: true,
	},
];
