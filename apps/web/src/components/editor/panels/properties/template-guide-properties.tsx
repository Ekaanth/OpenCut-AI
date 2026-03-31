"use client";

import { useCallback, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "./section";
import {
	SparklesIcon,
	ViewIcon,
	Mic01Icon,
	MusicNote03Icon,
	Image01Icon,
	Tick01Icon,
	ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { aiClient } from "@/lib/ai-client";
import { useEditor } from "@/hooks/use-editor";
import { buildImageElement } from "@/lib/timeline/element-utils";
import type { TextElement } from "@/types/timeline";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Parse structured content from the guide element
// ---------------------------------------------------------------------------

interface ParsedGuideContent {
	title: string;
	visualDescription: string;
	narration: string;
	keyMessage: string;
	mood: string;
}

function parseGuideContent(element: TextElement): ParsedGuideContent {
	const content = element.content || "";
	const lines = content.split("\n");

	let title = "";
	let visualDescription = "";
	let narration = "";
	let keyMessage = "";
	let mood = "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			title = trimmed.slice(1, -1);
		} else if (trimmed.startsWith("Visual:")) {
			visualDescription = trimmed.replace("Visual:", "").trim();
		} else if (trimmed.startsWith("Narration:")) {
			narration = trimmed.replace("Narration:", "").trim();
		} else if (trimmed.startsWith("Key:")) {
			keyMessage = trimmed.replace("Key:", "").trim();
		} else if (trimmed.startsWith("Mood:")) {
			mood = trimmed.replace("Mood:", "").trim();
		}
	}

	// Fallback: use element name for title
	if (!title) {
		title = element.name.replace(/^\d+\.\s*/, "");
	}

	return { title, visualDescription, narration, keyMessage, mood };
}

// ---------------------------------------------------------------------------
// Check if an element is a template guide
// ---------------------------------------------------------------------------

export function isTemplateGuideElement(element: { type: string; hidden?: boolean; opacity?: number; color?: string; fontSize?: number; name?: string; content?: string }): boolean {
	if (element.type !== "text") return false;
	// Match by the combination of properties that template guides have:
	// - name starts with "N. " (segment order)
	// - opacity 0 and transparent color (invisible on canvas)
	// - fontSize 1 (effectively zero)
	// - content has structured markers like "[Title]" and "Visual:" / "Narration:"
	const nameMatch = /^\d+\.\s/.test(element.name ?? "");
	const isInvisible = element.opacity === 0 && element.color === "transparent" && element.fontSize === 1;
	const hasGuideContent = typeof element.content === "string" &&
		element.content.includes("[") &&
		(element.content.includes("Visual:") || element.content.includes("Narration:"));

	// Primary: hidden flag set (new elements)
	// Fallback: invisible + structured content (elements created before hidden was passed through)
	return nameMatch && (element.hidden === true || (isInvisible && hasGuideContent));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateGuideProperties({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const parsed = parseGuideContent(element);

	const [prompt, setPrompt] = useState("");
	const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
	const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
	const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
	const [inserted, setInserted] = useState(false);
	const [provider, setProvider] = useState<"seedance" | "local">("seedance");

	// ── Generate prompt from visual description ──

	const handleGeneratePrompt = useCallback(async () => {
		if (isGeneratingPrompt) return;
		setIsGeneratingPrompt(true);
		try {
			const result = await aiClient.generateVideoPrompt(
				parsed.title,
				`${parsed.visualDescription}. ${parsed.narration}. Mood: ${parsed.mood}`,
				parsed.mood || "cinematic",
			);
			setPrompt(result.prompt);
			toast.success("Prompt generated");
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to generate prompt. Make sure AI backend is running.",
			);
		} finally {
			setIsGeneratingPrompt(false);
		}
	}, [parsed, isGeneratingPrompt]);

	// ── Generate image from prompt and insert at segment time ──

	const handleGenerateImage = useCallback(async () => {
		const p = prompt.trim();
		if (!p) {
			toast.error("Generate or write a prompt first");
			return;
		}
		setIsGeneratingMedia(true);
		try {
			const result = await aiClient.generateImage({
				prompt: p,
				width: 1024,
				height: 576,
				steps: 20,
				guidanceScale: 7.5,
			});
			setGeneratedUrl(result.imageUrl);
			toast.success("Image generated");
		} catch {
			toast.error("Image generation failed");
		} finally {
			setIsGeneratingMedia(false);
		}
	}, [prompt]);

	// ── Generate video from prompt ──

	const handleGenerateVideo = useCallback(async () => {
		const p = prompt.trim();
		if (!p) {
			toast.error("Generate or write a prompt first");
			return;
		}
		setIsGeneratingMedia(true);
		try {
			const result = await aiClient.generateVideo({
				prompt: p,
				duration: Math.min(Math.round(element.duration), 15),
				width: 1920,
				height: 1080,
				provider,
			});

			if (result.status === "completed" && result.videoUrl) {
				setGeneratedUrl(result.videoUrl);
				toast.success("Video generated");
			} else if (result.jobId) {
				toast.info("Video generation started — this may take a few minutes");
				// Poll for result
				const poll = setInterval(async () => {
					try {
						const job = await aiClient.getVideoJob(result.jobId!);
						if (job.status === "completed" && job.videoUrl) {
							clearInterval(poll);
							setGeneratedUrl(job.videoUrl);
							setIsGeneratingMedia(false);
							toast.success("Video ready");
						} else if (job.status === "failed") {
							clearInterval(poll);
							setIsGeneratingMedia(false);
							toast.error(job.error || "Video generation failed");
						}
					} catch {
						/* keep polling */
					}
				}, 3000);
				return; // don't set isGeneratingMedia to false yet
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Video generation failed",
			);
		}
		setIsGeneratingMedia(false);
	}, [prompt, element.duration, provider]);

	// ── Insert generated media to timeline at segment position ──

	const handleInsertToTimeline = useCallback(() => {
		if (!generatedUrl) return;

		const imgElement = buildImageElement({
			mediaId: `guide-media-${element.id}-${Date.now()}`,
			name: `${parsed.title}`,
			duration: element.duration,
			startTime: element.startTime,
		});

		editor.timeline.insertElement({
			element: imgElement,
			placement: { mode: "auto" },
		});

		setInserted(true);
		toast.success(
			`Inserted at ${element.startTime.toFixed(1)}s (${element.duration.toFixed(1)}s)`,
		);
	}, [generatedUrl, element, parsed.title, editor]);

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="px-4 py-3 border-b">
				<div className="flex items-center gap-2 mb-1">
					<div className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary shrink-0">
						<span className="text-[11px] font-bold">
							{element.name.match(/^(\d+)/)?.[1] || "?"}
						</span>
					</div>
					<div>
						<p className="text-sm font-medium">{parsed.title}</p>
						<p className="text-[10px] text-muted-foreground">
							{element.startTime.toFixed(1)}s &ndash;{" "}
							{(element.startTime + element.duration).toFixed(1)}s
							<span className="mx-1">&middot;</span>
							{element.duration.toFixed(1)}s
						</p>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{/* Key Message */}
				{parsed.keyMessage && (
					<Section showTopBorder={false}>
						<SectionHeader>
							<SectionTitle>Key Message</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<p className="text-sm font-semibold">{parsed.keyMessage}</p>
						</SectionContent>
					</Section>
				)}

				{/* Narration */}
				{parsed.narration && (
					<Section>
						<SectionHeader>
							<div className="flex items-center gap-1">
								<HugeiconsIcon
									icon={Mic01Icon}
									className="size-3 text-muted-foreground"
								/>
								<SectionTitle>Voiceover Script</SectionTitle>
							</div>
						</SectionHeader>
						<SectionContent>
							<p className="text-xs text-muted-foreground leading-relaxed">
								{parsed.narration}
							</p>
						</SectionContent>
					</Section>
				)}

				{/* Visual Direction */}
				{parsed.visualDescription && (
					<Section>
						<SectionHeader>
							<div className="flex items-center gap-1">
								<HugeiconsIcon
									icon={ViewIcon}
									className="size-3 text-primary"
								/>
								<SectionTitle>Visual Direction</SectionTitle>
							</div>
						</SectionHeader>
						<SectionContent>
							<p className="text-xs italic leading-relaxed">
								{parsed.visualDescription}
							</p>
						</SectionContent>
					</Section>
				)}

				{/* Mood */}
				{parsed.mood && (
					<Section>
						<SectionHeader>
							<div className="flex items-center gap-1">
								<HugeiconsIcon
									icon={MusicNote03Icon}
									className="size-3 text-muted-foreground"
								/>
								<SectionTitle>Mood</SectionTitle>
							</div>
						</SectionHeader>
						<SectionContent>
							<Badge variant="outline" className="text-xs">
								{parsed.mood}
							</Badge>
						</SectionContent>
					</Section>
				)}

				{/* Prompt + Generation */}
				<Section>
					<SectionHeader>
						<div className="flex items-center gap-1">
							<HugeiconsIcon
								icon={SparklesIcon}
								className="size-3 text-primary"
							/>
							<SectionTitle>Generate Visual</SectionTitle>
						</div>
					</SectionHeader>
					<SectionContent>
						<div className="flex flex-col gap-2">
							{/* Prompt */}
							<div className="flex flex-col gap-1">
								<div className="flex items-center justify-between">
									<label className="text-[10px] font-medium text-muted-foreground">
										Prompt
									</label>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[9px] px-1.5"
										disabled={isGeneratingPrompt}
										onClick={handleGeneratePrompt}
									>
										{isGeneratingPrompt ? (
											<Spinner className="size-2.5 mr-1" />
										) : (
											<HugeiconsIcon
												icon={SparklesIcon}
												className="size-2.5 mr-1"
											/>
										)}
										{prompt ? "Regenerate" : "Generate Prompt"}
									</Button>
								</div>
								<Textarea
									value={prompt}
									onChange={(e) => setPrompt(e.target.value)}
									placeholder="Click 'Generate Prompt' or write your own..."
									rows={3}
									className="text-[11px] font-mono"
								/>
							</div>

							{/* Generated preview */}
							{generatedUrl && (
								<div className="rounded-lg overflow-hidden border bg-black">
									{generatedUrl.endsWith(".mp4") ? (
										<video
											src={generatedUrl}
											controls
											className="w-full max-h-28 object-contain"
										/>
									) : (
										<img
											src={generatedUrl}
											alt={parsed.title}
											className="w-full max-h-28 object-contain"
										/>
									)}
								</div>
							)}

							{/* Provider toggle */}
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-muted-foreground">
									Provider
								</span>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => setProvider("seedance")}
										className={cn(
											"text-[9px] px-2 py-0.5 rounded border transition-colors",
											provider === "seedance"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-background hover:bg-accent border-border",
										)}
									>
										Seedance
									</button>
									<button
										type="button"
										onClick={() => setProvider("local")}
										className={cn(
											"text-[9px] px-2 py-0.5 rounded border transition-colors",
											provider === "local"
												? "bg-primary text-primary-foreground border-primary"
												: "bg-background hover:bg-accent border-border",
										)}
									>
										Local
									</button>
								</div>
							</div>

							{/* Action buttons */}
							<div className="flex flex-col gap-1.5">
								<div className="flex gap-1.5">
									<Button
										size="sm"
										variant="outline"
										className="flex-1 h-7 text-[10px]"
										disabled={!prompt.trim() || isGeneratingMedia}
										onClick={handleGenerateImage}
									>
										{isGeneratingMedia ? (
											<Spinner className="size-3 mr-1" />
										) : (
											<HugeiconsIcon
												icon={Image01Icon}
												className="size-3 mr-1"
											/>
										)}
										Generate Image
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="flex-1 h-7 text-[10px]"
										disabled={!prompt.trim() || isGeneratingMedia}
										onClick={handleGenerateVideo}
									>
										{isGeneratingMedia ? (
											<Spinner className="size-3 mr-1" />
										) : (
											<HugeiconsIcon
												icon={SparklesIcon}
												className="size-3 mr-1"
											/>
										)}
										Generate Video
									</Button>
								</div>

								{generatedUrl && !inserted && (
									<Button
										size="sm"
										className="w-full h-7 text-[10px]"
										onClick={handleInsertToTimeline}
									>
										<HugeiconsIcon
											icon={ArrowDown01Icon}
											className="size-3 mr-1"
										/>
										Insert at {element.startTime.toFixed(1)}s
									</Button>
								)}

								{inserted && (
									<Button
										size="sm"
										variant="outline"
										className="w-full h-7 text-[10px]"
										disabled
									>
										<HugeiconsIcon
											icon={Tick01Icon}
											className="size-3 mr-1 text-green-500"
										/>
										Added to Timeline
									</Button>
								)}
							</div>
						</div>
					</SectionContent>
				</Section>
			</div>
		</div>
	);
}
