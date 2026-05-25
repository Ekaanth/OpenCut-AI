"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	VideoReplayIcon,
	SparklesIcon,
	Image01Icon,
	Add01Icon,
	Link01Icon,
	Clock01Icon,
	Download04Icon,
	InformationSquareIcon,
} from "@hugeicons/core-free-icons";
import { useVideoGeneration } from "@/hooks/use-video-generation";
import {
	VIDEO_MODELS,
	VIDEO_ASPECT_RATIOS,
	VIDEO_PROVIDER_CONFIGS,
	getModelsForProvider,
	getProviderConfig,
	isProviderKeyRequired,
	type VideoGenMode,
	type VideoProvider,
} from "@/lib/video-gen/video-gen-types";
import { getApiKey } from "@/lib/api-keys";

const MODE_LABELS: Record<VideoGenMode, { label: string; icon: typeof VideoReplayIcon; desc: string }> = {
	"text-to-video": { label: "Text → Video", icon: VideoReplayIcon, desc: "Generate video from a text prompt" },
	"image-to-video": { label: "Image → Video", icon: Image01Icon, desc: "Animate an image into a video" },
	"video-to-video": { label: "Video → Video", icon: VideoReplayIcon, desc: "Transform an existing video" },
};

export function VideoGenerationPanel({ className }: { className?: string }) {
	const {
		status, progress, currentJob, jobs, error,
		selectedModel, selectedAspectRatio, duration, genMode, imageUrl,
		setSelectedModel, setSelectedAspectRatio, setDuration, setGenMode, setImageUrl,
		generate, enhancePrompt, addToTimeline, clearJob, clearError,
	} = useVideoGeneration();

	const [prompt, setPrompt] = useState("");
	const [imageUrlInput, setImageUrlInput] = useState("");
	const [enhancing, setEnhancing] = useState(false);
	const [providerFilter, setProviderFilter] = useState<VideoProvider | "all">("all");
	const promptRef = useRef<HTMLTextAreaElement>(null);

	const model = VIDEO_MODELS.find((m) => m.id === selectedModel);
	const provider = model?.provider || "replicate";
	const providerConfig = getProviderConfig(provider);
	const hasApiKey = !isProviderKeyRequired(provider) || !!getApiKey(providerConfig?.apiKeyLocalStorageKey || "");

	const filteredModels = providerFilter === "all"
		? VIDEO_MODELS
		: getModelsForProvider(providerFilter);

	const availableModels = filteredModels.filter((m) =>
		m.supportedModes.includes(genMode),
	);

	const handleGenerate = useCallback(() => {
		generate(prompt);
	}, [generate, prompt]);

	const handleEnhance = useCallback(async () => {
		if (!prompt.trim()) return;
		setEnhancing(true);
		try {
			const enhanced = await enhancePrompt(prompt);
			setPrompt(enhanced);
		} finally {
			setEnhancing(false);
		}
	}, [prompt, enhancePrompt]);

	const handleAddToTimeline = useCallback((videoUrl: string) => {
		addToTimeline(videoUrl);
	}, [addToTimeline]);

	const isBusy = status === "generating" || status === "polling" || status === "enhancing";

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={VideoReplayIcon} className="size-4 text-primary" />
					<span className="text-xs font-medium">AI Video Generation</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Generate video from text, images, or existing clips using multiple AI providers.
				</p>
			</div>

			<div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
				{/* Generation Mode Tabs */}
				<div className="flex gap-1">
					{(Object.entries(MODE_LABELS) as [VideoGenMode, typeof MODE_LABELS[VideoGenMode]][]).map(([mode, info]) => (
						<button
							key={mode}
							className={cn(
								"flex-1 rounded border px-2 py-1.5 text-[8px] text-center transition-colors",
								genMode === mode
									? "border-primary bg-primary/5 text-primary"
									: "border-border hover:border-primary/30 text-muted-foreground",
							)}
							onClick={() => setGenMode(mode)}
						>
							<HugeiconsIcon icon={info.icon} className="size-3 mx-auto mb-0.5" />
							{info.label}
						</button>
					))}
				</div>

				{/* Provider Filter */}
				<div className="space-y-1">
					<span className="text-[9px] font-medium text-muted-foreground">Provider</span>
					<div className="flex flex-wrap gap-1">
						<button
							className={cn(
								"rounded px-1.5 py-0.5 text-[8px] transition-colors",
								providerFilter === "all"
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setProviderFilter("all")}
						>
							All
						</button>
						{VIDEO_PROVIDER_CONFIGS.map((pc) => (
							<button
								key={pc.provider}
								className={cn(
									"rounded px-1.5 py-0.5 text-[8px] transition-colors",
									providerFilter === pc.provider
										? "bg-primary/10 text-primary font-medium"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setProviderFilter(pc.provider)}
							>
								{pc.label}
							</button>
						))}
						<button
							className={cn(
								"rounded px-1.5 py-0.5 text-[8px] transition-colors",
								providerFilter === "local"
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setProviderFilter("local")}
						>
							Local
						</button>
					</div>
				</div>

				{/* Model Selection */}
				<div className="space-y-1">
					<span className="text-[9px] font-medium text-muted-foreground">Model</span>
					<Select value={selectedModel} onValueChange={setSelectedModel}>
						<SelectTrigger className="h-7 text-[10px]">
							<SelectValue placeholder="Select model" />
						</SelectTrigger>
						<SelectContent>
							{availableModels.map((m) => (
								<SelectItem key={m.id} value={m.id}>
									<span className="text-[10px]">
										{m.name}
										<span className="text-muted-foreground ml-1">({m.provider})</span>
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{model && (
						<p className="text-[8px] text-muted-foreground">{model.description}</p>
					)}
				</div>

				{/* Aspect Ratio */}
				<div className="space-y-1">
					<span className="text-[9px] font-medium text-muted-foreground">Aspect Ratio</span>
					<div className="flex flex-wrap gap-1">
						{VIDEO_ASPECT_RATIOS.filter((r) => !model || model.aspectRatios.includes(r.id)).map((ar) => (
							<button
								key={ar.id}
								className={cn(
									"rounded border px-2 py-1 text-[8px] transition-colors",
									selectedAspectRatio === ar.id
										? "border-primary bg-primary/5 text-primary font-medium"
										: "border-border hover:border-primary/30",
								)}
								onClick={() => setSelectedAspectRatio(ar.id)}
							>
								{ar.label}
							</button>
						))}
					</div>
				</div>

				{/* Duration */}
				<div className="space-y-1">
					<div className="flex justify-between text-[9px]">
						<span className="font-medium text-muted-foreground">Duration</span>
						<span className="font-mono">{duration}s</span>
					</div>
					<Slider
						value={[duration]}
						onValueChange={([v]) => setDuration(v)}
						min={1}
						max={model?.maxDuration || 15}
						step={1}
					/>
				</div>

				{/* Image URL (for image-to-video) */}
				{genMode === "image-to-video" && (
					<div className="space-y-1">
						<span className="text-[9px] font-medium text-muted-foreground">Source Image URL</span>
						<div className="flex gap-1">
							<input
								type="url"
								placeholder="https://example.com/image.jpg"
								value={imageUrlInput}
								onChange={(e) => {
									setImageUrlInput(e.target.value);
									setImageUrl(e.target.value);
								}}
								className="flex-1 rounded border bg-background px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-ring"
							/>
						</div>
						<p className="text-[8px] text-muted-foreground">
							Paste a URL to an image. Use the Image Generation tool to create one first.
						</p>
					</div>
				)}

				{/* Prompt */}
				<div className="space-y-1">
					<div className="flex items-center justify-between">
						<span className="text-[9px] font-medium text-muted-foreground">Prompt</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-4 text-[8px] px-1"
							onClick={handleEnhance}
							disabled={enhancing || !prompt.trim()}
						>
							<HugeiconsIcon icon={SparklesIcon} className="size-3 mr-0.5" />
							{enhancing ? "Enhancing..." : "Enhance"}
						</Button>
					</div>
					<Textarea
						ref={promptRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Describe the video you want to generate..."
						className="min-h-[60px] text-[10px] resize-none"
						rows={3}
					/>
				</div>

				{/* API Key Warning */}
				{!hasApiKey && model && isProviderKeyRequired(model.provider) && providerConfig && (
					<div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2 space-y-1">
						<div className="flex items-center gap-1">
							<HugeiconsIcon icon={InformationSquareIcon} className="size-3 text-yellow-500" />
							<span className="text-[9px] font-medium text-yellow-500">
								{providerConfig.label} API Key Required
							</span>
						</div>
						<p className="text-[8px] text-muted-foreground">
							Add your {providerConfig.label} API key in Settings → API Keys to use {model.name}.
						</p>
						<a
							href={providerConfig.signupUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[8px] text-primary hover:underline"
						>
							Get API key →
						</a>
					</div>
				)}

				{/* Generate Button */}
				{(status === "idle" || status === "done" || status === "error") && (
					<Button
						className="w-full"
						onClick={handleGenerate}
						disabled={!prompt.trim() || !hasApiKey || !model}
					>
						<HugeiconsIcon icon={VideoReplayIcon} className="size-4 mr-1.5" />
						Generate Video
						{model && <Badge variant="secondary" className="ml-2 text-[7px]">{model.costLabel}</Badge>}
					</Button>
				)}

				{/* Progress */}
				{isBusy && (
					<div className="space-y-2">
						<div className="h-1.5 rounded-full bg-secondary overflow-hidden">
							<div
								className="h-full bg-primary rounded-full transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<div className="flex items-center justify-center gap-1.5">
							<Spinner className="size-3" />
							<span className="text-[10px] text-muted-foreground">
								{status === "generating" ? "Starting generation..." : `Polling for result... ${progress}%`}
							</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="w-full h-5 text-[8px]"
							onClick={() => {
								clearError();
							}}
						>
							Cancel
						</Button>
					</div>
				)}

				{/* Result */}
				{status === "done" && currentJob?.videoUrl && (
					<div className="rounded border p-2 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-[9px] font-medium">Result</span>
							<Badge variant="secondary" className="text-[7px]">{model?.name}</Badge>
						</div>
						<video
							src={currentJob.videoUrl}
							controls
							className="w-full rounded"
							style={{ maxHeight: 200 }}
						/>
						<div className="flex gap-1.5">
							<Button
								className="flex-1 h-6 text-[9px]"
								onClick={() => handleAddToTimeline(currentJob.videoUrl!)}
							>
								<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
								Add to Timeline
							</Button>
							<a
								href={currentJob.videoUrl}
								download
								className="inline-flex items-center justify-center rounded-md border px-2 h-6 text-[9px] hover:bg-accent"
							>
								<HugeiconsIcon icon={Download04Icon} className="size-3" />
							</a>
						</div>
					</div>
				)}

				{/* Error */}
				{status === "error" && error && (
					<div className="rounded border border-red-500/20 bg-red-500/5 p-2">
						<p className="text-[9px] text-red-500">{error}</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-1.5 h-5 text-[8px]"
							onClick={clearError}
						>
							Try Again
						</Button>
					</div>
				)}

				{/* Generation History */}
				{jobs.length > 1 && (
					<div className="space-y-1">
						<span className="text-[9px] font-medium text-muted-foreground">
							Previous Generations ({jobs.length})
						</span>
						<div className="space-y-1 max-h-32 overflow-y-auto">
							{jobs.slice(1).map((job) => (
								<div
									key={job.id}
									className="rounded border p-1.5 flex items-center gap-2"
								>
									<HugeiconsIcon
										icon={VideoReplayIcon}
										className={cn(
											"size-3 shrink-0",
											job.status === "completed" ? "text-green-500" : "text-red-500",
										)}
									/>
									<span className="text-[8px] truncate flex-1">
										{job.prompt.substring(0, 40)}...
									</span>
									<span className="text-[7px] text-muted-foreground shrink-0">
										{VIDEO_MODELS.find((m) => m.id === job.model)?.name || job.provider}
									</span>
									{job.videoUrl && (
										<Button
											variant="ghost"
											size="sm"
											className="h-4 w-4 p-0"
											onClick={() => handleAddToTimeline(job.videoUrl!)}
										>
											<HugeiconsIcon icon={Add01Icon} className="size-3" />
										</Button>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
