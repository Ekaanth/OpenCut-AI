import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Badge } from "@/components/ui/badge";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

const LAST_UPDATED = "July 17, 2026";

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

const roadmapItems: RoadmapItem[] = [
	{
		title: "OpenCut — the foundation",
		description:
			"[OpenCut](https://github.com/OpenCut-app/OpenCut) is the open-source video editor this project is forked from. It provides the core editor — multi-track timeline, real-time preview, text/sticker/effect tracks, keyboard shortcuts, and browser-based storage. Huge thanks to the OpenCut team and all upstream contributors.",
		status: {
			text: "Upstream",
			type: "complete",
		},
	},
	{
		title: "Fork & AI integration",
		description:
			"[OpenCut AI](https://github.com/Ekaanth/OpenCut-AI) is a fork that wraps AI capabilities around the core editor. The goal: make video editing accessible to non-editors by letting them edit videos through text, voice, and AI commands — all running locally.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "AI transcription & text-based editing",
		description:
			"Backend Whisper service for speech-to-text with word-level timestamps. Transcript panel with live word highlighting, auto-scroll, segment deletion, word-level cuts, and drag-to-reorder. Video auto-splits at segment boundaries. Delete text to cut video, reorder text to rearrange scenes.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Voice cloning & TTS",
		description:
			"Coqui XTTS v2 for multilingual voice generation with voice cloning. Upload a voice sample to clone any voice. Generate voiceovers per-segment from the transcript. Male/female voice selection. Auto-translation for multilingual voiceovers. Background task tracking in the UI.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Subtitles & multilingual support",
		description:
			"One-click subtitle generation from transcript, positioned at the bottom of the screen. Add/remove subtitles toggle. Auto-translation of transcript to 12+ languages for multilingual subtitle tracks. Subtitle text elements on their own timeline track.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Filters, adjustments & effects",
		description:
			"WebGL color-adjust shader with 12 filter presets (Grayscale, Sepia, Vintage, Warm, Cool, Vivid, etc.). Adjustment panel with brightness, contrast, saturation, temperature, and vignette sliders. Effects applied as timeline tracks scoped to selected clips.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Audio separation & volume control",
		description:
			"Auto-separate audio from video into its own track. Per-clip volume control with draggable dB line on audio elements. Volume changes apply to playback in real-time via Web Audio GainNode. Split audio clips to set different volumes per section.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Overlays & compositing",
		description:
			"Picture-in-picture presets (corner positions, center). Split screen (left/right, top/bottom). Compositing presets (ghost overlay, dark overlay, light leak). Per-element opacity, 17 blend modes, and transform controls.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "AI Studio & fact-checking",
		description:
			"AI chat for brainstorming, script writing, and content planning. Script editing mode — rewrite transcript via AI prompts. Fact-check panel — extracts claims from transcript and verifies them via LLM. Fact-check overlays on the video timeline.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Quick actions & filler removal",
		description:
			"Quick actions bar with one-click filler word detection, silence detection, subtitle toggle, and fact-check. Actions derive state from the actual timeline — stay in sync across all panels. Filler words shown with dotted underline in transcript.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Self-hosting & infrastructure",
		description:
			"Full Docker Compose setup with 9 services (web, AI backend, Whisper, TTS, image, Ollama, Postgres, Redis). Health monitoring via proxied endpoint. RAM/GPU status in header. API keys management in Settings. Self-hosting cost documentation.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Export",
		description:
			"MP4 (H.264) and WebM (VP9) export with quality presets (Low to Very High). Platform presets for YouTube, TikTok, Instagram, etc. Audio mixing with per-element volume. Progress bar with cancel support. Direct file download.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Advanced export & rendering",
		description:
			"Subtitle burn-in during export. Background export that doesn't block the UI. Batch export for multiple formats. Custom resolution and bitrate controls. GPU-accelerated rendering.",
		status: {
			text: "Planned",
			type: "pending",
		},
	},
	{
		title: "Multilingual captions (NLLB)",
		description:
			"Translate captions into multiple languages at once via the local NLLB-200 service, with one subtitle track per language and per-language SRT/VTT export. Falls back to Sarvam or the local LLM per language when NLLB is unavailable. No data-model change — reuses the existing translation + subtitle-track infrastructure.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Edit by speaker",
		description:
			"Scope operations to a single speaker: remove their every segment (cuts the timeline too), tighten the gaps between their lines, or isolate them by muting other tracks. Reuses diarization plus the shared timeline-cut helpers first introduced by Smart Cut.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Auto multicam sync",
		description:
			"Align camera angles that weren't timecode-locked by cross-correlating their audio waveforms — entirely on-device via the Web Audio API. Pick a reference angle, preview per-angle offsets with confidence scores, then apply with one undoable transaction.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "AI Dubbing (local NLLB + XTTS)",
		description:
			"Translate and re-voice video into 17 languages. A dedicated NLLB-200 translate-service runs fully on-device for the 'Local' engine — translation text never leaves the host. Combined with voice-cloned XTTS v2 for the privacy-first dubbing path. Cloud engines (Sarvam, Smallest) remain available as alternatives.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Video background removal",
		description:
			"Remove the background from any video clip with no green screen. Per-frame rembg matting produces a transparent WebM, inserted non-destructively above the source clip. Configurable sampling rate, runs fully locally via the image-service.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "Auto B-roll from your footage",
		description:
			"Matches each transcript segment to your own media library by CLIP visual similarity and auto-inserts the best clip as an overlay. Reuses the on-device CLIP embedding index — your footage never leaves your machine. Threshold-tunable, with a reviewable per-segment match list.",
		status: {
			text: "Completed",
			type: "complete",
		},
	},
	{
		title: "More AI models",
		description:
			"Model download manager in the UI. Support for StyleTTS 2, Bark, Piper, Fish Speech, Kokoro for TTS. Switchable Whisper model sizes (tiny to large-v3). Cloud API fallbacks (OpenAI, ElevenLabs) as optional alternatives.",
		status: {
			text: "Planned",
			type: "pending",
		},
	},
	{
		title: "Native app (mobile/desktop)",
		description:
			"Native OpenCut AI apps for Mac, Windows, Linux, and iOS/Android.",
		status: {
			text: "Not started",
			type: "default",
		},
	},
];

export const metadata: Metadata = {
	title: "Roadmap - OpenCut AI",
	description:
		"See what's coming next for OpenCut AI - the free, open-source video editor that respects your privacy.",
	openGraph: {
		title: "OpenCut AI Roadmap - What's Coming Next",
		description:
			"See what's coming next for OpenCut AI - the free, open-source video editor that respects your privacy.",
		type: "website",
		images: [
			{
				url: "/open-graph/roadmap.jpg",
				width: 1200,
				height: 630,
				alt: "OpenCut AI Roadmap",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenCut AI Roadmap - What's Coming Next",
		description:
			"See what's coming next for OpenCut AI - the free, open-source video editor that respects your privacy.",
		images: ["/open-graph/roadmap.jpg"],
	},
};

export default function RoadmapPage() {
	return (
		<BasePage
			title="Roadmap"
			description={`OpenCut AI is a fork of OpenCut with AI wrapped around it. Here's what's been built and what's next. (last updated: ${LAST_UPDATED})`}
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				<div className="flex flex-col gap-6">
					{roadmapItems.map((item, index) => (
						<RoadmapItem key={item.title} item={item} index={index} />
					))}
				</div>
				<GitHubContributeSection
					title="Want to help?"
					description="OpenCut AI is open source and built by the community. Every contribution,
          no matter how small, helps us build the best free video editor
          possible."
				/>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-medium">
				<span className="leading-normal select-none">{index + 1}</span>
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-green-500! text-white": status.type === "complete",
				"bg-yellow-500! text-white": status.type === "pending",
				"bg-blue-500! text-white": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}
