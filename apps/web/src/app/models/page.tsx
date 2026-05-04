import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/ui";

export const metadata: Metadata = {
	title: "Models - OpenCut AI",
	description:
		"Open-source AI models powering OpenCut AI. Transcription, image generation, voice synthesis, speaker detection, and more — all running locally.",
	openGraph: {
		title: "Models - OpenCut AI",
		description:
			"Open-source AI models powering OpenCut AI. Transcription, image generation, voice synthesis, speaker detection, and more — all running locally.",
		type: "website",
	},
};

interface AIModel {
	name: string;
	provider: string;
	category: string;
	description: string;
	size: string;
	license: string;
	link: string;
	tags: string[];
}

const models: AIModel[] = [
	{
		name: "Kimi K2",
		provider: "MoonshotAI",
		category: "Language Model",
		description:
			"MoonshotAI's flagship open-source model — 1T total / 32B active MoE architecture. Frontier-class reasoning for complex video scripts, agentic editing commands, and long-context analysis. Runs via Ollama (Q3/Q4/Q5 GGUF) or TurboQuant (HuggingFace, 4-bit NF4). Context: 128K tokens.",
		size: "1T (32B active) MoE",
		license: "Kimi K2 Open",
		link: "https://github.com/MoonshotAI/Kimi-K2",
		tags: ["commands", "scripts", "reasoning", "long-context", "turboquant"],
	},
	{
		name: "Kimi VL A3B",
		provider: "MoonshotAI",
		category: "Language Model",
		description:
			"Kimi Vision-Language model with 3B active parameters. Understands images and text for scene analysis, video frame description, and multimodal editing commands. Two variants: Instruct (general) and Thinking (chain-of-thought reasoning). Runs via TurboQuant with 4-bit NF4 quantization.",
		size: "3B active params",
		license: "Apache 2.0",
		link: "https://huggingface.co/moonshotai",
		tags: ["multimodal", "vision", "reasoning", "turboquant"],
	},
	{
		name: "Whisper",
		provider: "OpenAI",
		category: "Speech-to-Text",
		description:
			"Automatic speech recognition with word-level timestamps. Powers transcription, subtitles, and text-based editing. Available from tiny (39M) to large-v3 (1.5B). TurboQuant compression lets Whisper Medium fit where only Base could before.",
		size: "39M - 1.5B params",
		license: "MIT",
		link: "https://github.com/openai/whisper",
		tags: ["transcription", "subtitles", "timestamps"],
	},
	{
		name: "Llama 3.2 / 3.1",
		provider: "Meta",
		category: "Language Model",
		description:
			"Powers AI commands, script writing, chapter analysis, clip finding, smart suggestions, and prompt enhancement. Runs via Ollama. Available at 1B (Lite), 3B (Standard), and 8B (Pro) with Q3/Q4/Q5 quantization.",
		size: "1B - 8B params",
		license: "Llama 3 Community",
		link: "https://github.com/meta-llama/llama-models",
		tags: ["commands", "scripts", "analysis", "chapters"],
	},
	{
		name: "Mistral 7B",
		provider: "Mistral AI",
		category: "Language Model",
		description:
			"High quality 7B instruction-tuned model. Available at Q4 (Standard tier) and Q5 (Pro tier). Strong at structured JSON generation for editor commands and content analysis.",
		size: "7B params",
		license: "Apache 2.0",
		link: "https://mistral.ai",
		tags: ["commands", "scripts", "json", "analysis"],
	},
	{
		name: "Qwen2.5",
		provider: "Alibaba",
		category: "Language Model",
		description:
			"TurboQuant-validated model family from 0.5B to 14B. The 3B Instruct variant is benchmarked with full compression data (0.9986 cosine similarity at 4-bit). Also includes Coder variants for technical content.",
		size: "0.5B - 14B params",
		license: "Apache 2.0",
		link: "https://github.com/QwenLM/Qwen2.5",
		tags: ["turboquant", "commands", "coding", "analysis"],
	},
	{
		name: "Stable Diffusion XL",
		provider: "Stability AI",
		category: "Image Generation",
		description:
			"Generate images from text prompts for video overlays, thumbnails, and B-roll. Supports SDXL Turbo (4-step fast generation) and full SDXL (20-step quality).",
		size: "3.5B - 6.6B params",
		license: "OpenRAIL-M",
		link: "https://github.com/Stability-AI/generative-models",
		tags: ["images", "overlays", "thumbnails"],
	},
	{
		name: "FLUX.1",
		provider: "Black Forest Labs",
		category: "Image Generation",
		description:
			"Next-generation text-to-image with superior prompt adherence and image quality. Alternative to SDXL for higher quality results.",
		size: "12B params",
		license: "Apache 2.0",
		link: "https://github.com/black-forest-labs/flux",
		tags: ["images", "overlays", "high-quality"],
	},
	{
		name: "XTTS v2",
		provider: "Coqui",
		category: "Text-to-Speech",
		description:
			"Local voice synthesis with voice cloning from a 6-second sample. Supports 17 languages. TurboQuant at 3-bit shrinks it from 1.8 GB to 0.6 GB while preserving voice quality.",
		size: "467M params",
		license: "MPL 2.0",
		link: "https://github.com/coqui-ai/TTS",
		tags: ["voiceover", "voice-cloning", "local"],
	},
	{
		name: "Sarvam AI (Saaras / Bulbul)",
		provider: "Sarvam AI",
		category: "Indian Languages",
		description:
			"Purpose-built for 22 Indian regional languages. Saaras v3 for transcription, Bulbul v3 for text-to-speech with 37+ natural voices, plus translation and transliteration. Hindi, Tamil, Telugu, Kannada, Bengali, Malayalam, and more.",
		size: "Cloud API",
		license: "API Key Required",
		link: "https://sarvam.ai",
		tags: ["indian-languages", "transcription", "tts", "translation"],
	},
	{
		name: "Smallest AI (Waves)",
		provider: "Smallest AI",
		category: "Multilingual TTS/STT",
		description:
			"Ultra-fast cloud TTS and STT. Lightning TTS with 80+ voices across 15 languages at ~100ms latency. Pulse STT covers 39 languages with speaker diarization and emotion detection.",
		size: "Cloud API",
		license: "API Key Required",
		link: "https://smallest.ai",
		tags: ["tts", "stt", "multilingual", "fast"],
	},
	{
		name: "Pyannote",
		provider: "Herve Bredin",
		category: "Speaker Detection",
		description:
			"Neural speaker diarization that identifies who is talking when. Powers multi-speaker detection and automatic speaker-boundary cuts. Falls back to FFmpeg silence-based detection when unavailable.",
		size: "~90M params",
		license: "MIT",
		link: "https://github.com/pyannote/pyannote-audio",
		tags: ["speakers", "diarization", "podcast"],
	},
	{
		name: "MediaPipe Face Detection",
		provider: "Google",
		category: "Face Detection",
		description:
			"Real-time face detection for auto-reframe. Tracks faces across video frames to generate 9:16 crops for TikTok, Reels, and Shorts.",
		size: "~1M params",
		license: "Apache 2.0",
		link: "https://github.com/google-ai-edge/mediapipe",
		tags: ["face-tracking", "auto-reframe", "9:16"],
	},
	{
		name: "SpeechBrain",
		provider: "SpeechBrain",
		category: "Emotion Detection",
		description:
			"Detects emotional peaks in audio for finding the most impactful moments. Used for clip scoring and highlight detection. Falls back to FFmpeg energy-based analysis locally.",
		size: "~300M params",
		license: "Apache 2.0",
		link: "https://github.com/speechbrain/speechbrain",
		tags: ["emotions", "highlights", "intensity"],
	},
	{
		name: "TurboQuant",
		provider: "OpenCut AI",
		category: "Model Optimization",
		description:
			"KV cache compression using Google Research's PolarQuant + QJL. Achieves 6x memory reduction at 3-bit with 0.9953 cosine similarity. Makes 7B models run on 8 GB RAM. One-click setup in Settings.",
		size: "Compression layer",
		license: "MIT",
		link: "https://github.com/tonbistudio/turboquant-pytorch",
		tags: ["compression", "memory", "optimization", "kv-cache"],
	},
	{
		name: "U-Net (rembg)",
		provider: "danielgatis",
		category: "Background Removal",
		description:
			"Remove backgrounds from images to create transparent overlays. Useful for speaker cutouts, product shots, and compositing.",
		size: "176M params",
		license: "MIT",
		link: "https://github.com/danielgatis/rembg",
		tags: ["background-removal", "compositing"],
	},
	{
		name: "noisereduce",
		provider: "Tim Sainburg",
		category: "Audio Processing",
		description:
			"Spectral gating noise reduction for cleaning up audio recordings. Removes background noise, hiss, and hum with adjustable strength.",
		size: "< 1M params",
		license: "MIT",
		link: "https://github.com/timsainb/noisereduce",
		tags: ["audio", "denoising", "cleanup"],
	},
];

const categories = [...new Set(models.map((m) => m.category))];

const categoryColors: Record<string, string> = {
	"Speech-to-Text": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	"Language Model": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	"Image Generation": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
	"Text-to-Speech": "bg-green-500/10 text-green-600 dark:text-green-400",
	"Indian Languages": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
	"Multilingual TTS/STT": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
	"Speaker Detection": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
	"Face Detection": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
	"Emotion Detection": "bg-red-500/10 text-red-600 dark:text-red-400",
	"Model Optimization": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	"Background Removal": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
	"Audio Processing": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

export default function ModelsPage() {
	return (
		<BasePage maxWidth="6xl">
			<div className="flex flex-col gap-8 text-center">
				<h1 className="text-5xl font-bold tracking-tight md:text-6xl">
					Models
				</h1>
				<p className="text-muted-foreground mx-auto max-w-2xl text-xl leading-relaxed text-pretty">
					Every AI model in OpenCut AI is open source and runs locally on
					your machine. Cloud APIs available for Indian and multilingual content.
				</p>
			</div>

			{/* Category overview */}
			<div className="flex flex-wrap justify-center gap-2">
				{categories.map((cat) => (
					<Badge
						key={cat}
						variant="secondary"
						className={cn("text-xs", categoryColors[cat])}
					>
						{cat}
					</Badge>
				))}
			</div>

			{/* Tier breakdown */}
			<div className="grid gap-4 sm:grid-cols-3">
				<TierCard
					name="Lite"
					ram="4-8 GB"
					models="Llama 3.2 1B / Kimi K2 Q3 + Whisper Base + noisereduce"
					description="Runs on any machine. Basic AI commands and transcription. Kimi K2 Q3 brings strong reasoning even in the Lite tier."
				/>
				<TierCard
					name="Standard"
					ram="8-16 GB"
					models="Kimi K2 Q4 / Llama 3.2 3B / Mistral 7B + Whisper Small + XTTS v2 + rembg"
					description="Recommended for most users. Kimi K2 Q4 delivers frontier reasoning with TurboQuant compression — the new sweet spot for video scripts."
					recommended
				/>
				<TierCard
					name="Pro"
					ram="16-32+ GB"
					models="Kimi K2 Q5 / Llama 3.1 8B + Whisper Medium + SDXL + XTTS v2 + full stack"
					description="Best quality across the board. Kimi K2 Q5 near-lossless at 5-bit with TurboQuant. GPU recommended for image generation and fast Kimi inference."
				/>
			</div>

			{/* TurboQuant highlight */}
			<Card className="border-emerald-500/30 bg-emerald-500/5">
				<CardContent className="flex flex-col gap-3 p-6">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-semibold">TurboQuant Memory Compression</h3>
						<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
							Built-in
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						All tiers benefit from TurboQuant KV cache compression. Full AI stack memory dropped from 35 GB to 15 GB. One-click setup in Settings auto-detects your hardware and recommends the best configuration.
					</p>
					<div className="grid grid-cols-3 gap-4 mt-1">
						<div className="text-center">
							<p className="font-mono text-lg font-bold">4-bit</p>
							<p className="text-muted-foreground text-xs">0.9986 cosine sim</p>
							<p className="text-muted-foreground text-[10px]">Near-lossless</p>
						</div>
						<div className="text-center">
							<p className="font-mono text-lg font-bold">3-bit</p>
							<p className="text-muted-foreground text-xs">0.9953 cosine sim</p>
							<p className="text-muted-foreground text-[10px]">5x compression</p>
						</div>
						<div className="text-center">
							<p className="font-mono text-lg font-bold">2-bit</p>
							<p className="text-muted-foreground text-xs">0.9874 cosine sim</p>
							<p className="text-muted-foreground text-[10px]">7.3x compression</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* All models */}
			<div className="flex flex-col gap-4">
				<h2 className="text-2xl font-bold tracking-tight">
					All models
				</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					{models.map((model) => (
						<ModelCard key={model.name} model={model} />
					))}
				</div>
			</div>
		</BasePage>
	);
}

function TierCard({
	name,
	ram,
	models,
	description,
	recommended,
}: {
	name: string;
	ram: string;
	models: string;
	description: string;
	recommended?: boolean;
}) {
	return (
		<Card
			className={cn(
				"relative",
				recommended && "border-primary",
			)}
		>
			{recommended && (
				<Badge className="absolute -top-2.5 right-4 text-[10px]">
					Recommended
				</Badge>
			)}
			<CardContent className="flex flex-col gap-3 p-6">
				<div className="flex items-baseline justify-between">
					<h3 className="text-lg font-semibold">{name}</h3>
					<span className="text-muted-foreground font-mono text-sm">
						{ram}
					</span>
				</div>
				<p className="text-muted-foreground text-xs font-mono leading-relaxed">
					{models}
				</p>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
			</CardContent>
		</Card>
	);
}

function ModelCard({ model }: { model: AIModel }) {
	return (
		<a
			href={model.link}
			target="_blank"
			rel="noopener noreferrer"
			className="group"
		>
			<Card className="h-full transition-colors group-hover:border-foreground/15">
				<CardContent className="flex flex-col gap-4 p-6">
					<div className="flex items-start justify-between gap-2">
						<div>
							<h3 className="font-semibold group-hover:underline">
								{model.name}
							</h3>
							<p className="text-muted-foreground text-xs">
								by {model.provider}
							</p>
						</div>
						<Badge
							variant="secondary"
							className={cn(
								"shrink-0 text-[10px]",
								categoryColors[model.category],
							)}
						>
							{model.category}
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{model.description}
					</p>
					<div className="flex items-center justify-between">
						<div className="flex flex-wrap gap-1.5">
							{model.tags.map((tag) => (
								<span
									key={tag}
									className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
								>
									{tag}
								</span>
							))}
						</div>
						<div className="text-muted-foreground flex shrink-0 items-center gap-3 text-[11px]">
							<span className="font-mono">{model.size}</span>
							<span>{model.license}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</a>
	);
}
