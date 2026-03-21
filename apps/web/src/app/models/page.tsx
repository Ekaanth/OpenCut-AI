import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/ui";

export const metadata: Metadata = {
	title: "Models - OpenCut AI",
	description:
		"Open-source AI models powering OpenCut AI. Transcription, image generation, voice synthesis, and more — all running locally.",
	openGraph: {
		title: "Models - OpenCut AI",
		description:
			"Open-source AI models powering OpenCut AI. Transcription, image generation, voice synthesis, and more — all running locally.",
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
		name: "Whisper",
		provider: "OpenAI",
		category: "Speech-to-Text",
		description:
			"Automatic speech recognition with word-level timestamps. Powers transcription, subtitles, and text-based editing. Available in multiple sizes from tiny (39M) to large-v3 (1.5B).",
		size: "39M – 1.5B params",
		license: "MIT",
		link: "https://github.com/openai/whisper",
		tags: ["transcription", "subtitles", "timestamps"],
	},
	{
		name: "Llama 3.2",
		provider: "Meta",
		category: "Language Model",
		description:
			"Powers the AI command interface, filler word detection, chapter analysis, smart suggestions, and prompt enhancement. Runs via Ollama.",
		size: "1B – 90B params",
		license: "Llama 3.2 Community",
		link: "https://github.com/meta-llama/llama-models",
		tags: ["commands", "analysis", "chapters", "fillers"],
	},
	{
		name: "Stable Diffusion XL",
		provider: "Stability AI",
		category: "Image Generation",
		description:
			"Generate images from text prompts for video overlays, thumbnails, and B-roll. Supports SDXL Turbo (4-step fast generation) and full SDXL (20-step quality).",
		size: "3.5B – 6.6B params",
		license: "OpenRAIL-M",
		link: "https://github.com/Stability-AI/generative-models",
		tags: ["images", "overlays", "thumbnails"],
	},
	{
		name: "FLUX.1",
		provider: "Black Forest Labs",
		category: "Image Generation",
		description:
			"Next-generation text-to-image model with superior prompt adherence and image quality. An alternative to SDXL for higher quality results.",
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
			"Natural-sounding speech synthesis with voice cloning. Upload a 6-30 second voice sample to clone any voice. Supports 17 languages.",
		size: "467M params",
		license: "MPL 2.0",
		link: "https://github.com/coqui-ai/TTS",
		tags: ["voiceover", "voice-cloning", "multilingual"],
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
	{
		name: "Transformers.js",
		provider: "Hugging Face",
		category: "Browser ML Runtime",
		description:
			"Run machine learning models directly in the browser using WebAssembly and WebGPU. Used for lightweight client-side inference tasks.",
		size: "Varies",
		license: "Apache 2.0",
		link: "https://github.com/huggingface/transformers.js",
		tags: ["browser", "wasm", "inference"],
	},
];

const categories = [...new Set(models.map((m) => m.category))];

const categoryColors: Record<string, string> = {
	"Speech-to-Text": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	"Language Model": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	"Image Generation": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
	"Text-to-Speech": "bg-green-500/10 text-green-600 dark:text-green-400",
	"Background Removal": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
	"Audio Processing": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
	"Browser ML Runtime": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
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
					your machine. No API keys, no cloud, no cost.
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
					size="~4 GB"
					description="Whisper (tiny) + Llama 3.2 (1B) + noisereduce. Runs on any machine with 8 GB RAM."
				/>
				<TierCard
					name="Standard"
					size="~12 GB"
					description="Whisper (base) + Llama 3.2 (3B) + SDXL Turbo + rembg. Recommended for most users."
					recommended
				/>
				<TierCard
					name="Full"
					size="~25 GB"
					description="Whisper (large-v3) + Llama 3.2 (8B) + SDXL + FLUX + XTTS v2. Best quality, needs a GPU."
				/>
			</div>

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
	size,
	description,
	recommended,
}: {
	name: string;
	size: string;
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
						{size}
					</span>
				</div>
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
