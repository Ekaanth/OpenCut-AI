"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, Image01Icon } from "@hugeicons/core-free-icons";

// ----- Types -----

export interface ImageGenModel {
	id: string;
	name: string;
	description?: string;
}

export type ImageAspectRatio = "16:9" | "9:16" | "1:1";

interface ImageGenResult {
	url: string;
	width: number;
	height: number;
}

interface ImageGenDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	models: ImageGenModel[];
	onGenerate: (params: {
		prompt: string;
		model: string;
		aspectRatio: ImageAspectRatio;
	}) => Promise<ImageGenResult | null>;
	onEnhancePrompt: (prompt: string) => Promise<string>;
	onAddToTimeline: (result: ImageGenResult) => void;
	className?: string;
}

// ----- Helpers -----

const ASPECT_RATIOS: {
	value: ImageAspectRatio;
	label: string;
	dimensions: string;
}[] = [
	{ value: "16:9", label: "Landscape", dimensions: "1920x1080" },
	{ value: "9:16", label: "Portrait", dimensions: "1080x1920" },
	{ value: "1:1", label: "Square", dimensions: "1024x1024" },
];

// ----- Component -----

export function ImageGenDialog({
	isOpen,
	onOpenChange,
	models,
	onGenerate,
	onEnhancePrompt,
	onAddToTimeline,
}: ImageGenDialogProps) {
	const [prompt, setPrompt] = useState("");
	const [enhancedPrompt, setEnhancedPrompt] = useState("");
	const [selectedModel, setSelectedModel] = useState(
		models[0]?.id ?? "",
	);
	const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("16:9");
	const [isEnhancing, setIsEnhancing] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [result, setResult] = useState<ImageGenResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleEnhance = async () => {
		if (!prompt.trim()) return;
		setIsEnhancing(true);
		setError(null);
		try {
			const enhanced = await onEnhancePrompt(prompt);
			setEnhancedPrompt(enhanced);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to enhance prompt",
			);
		} finally {
			setIsEnhancing(false);
		}
	};

	const handleGenerate = async () => {
		const finalPrompt = enhancedPrompt || prompt;
		if (!finalPrompt.trim()) return;

		setIsGenerating(true);
		setError(null);
		setResult(null);
		try {
			const generated = await onGenerate({
				prompt: finalPrompt,
				model: selectedModel,
				aspectRatio,
			});
			setResult(generated);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to generate image",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddToTimeline = () => {
		if (result) {
			onAddToTimeline(result);
			onOpenChange(false);
		}
	};

	const handleReset = () => {
		setPrompt("");
		setEnhancedPrompt("");
		setResult(null);
		setError(null);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon
							icon={Image01Icon}
							className="size-5 text-primary"
						/>
						Generate Image
					</DialogTitle>
					<DialogDescription>
						Describe the image you want to create. AI will generate it
						for your timeline.
					</DialogDescription>
				</DialogHeader>

				<DialogBody>
					{/* Prompt input */}
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Prompt</Label>
						<Textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="A cinematic sunset over a mountain range, golden hour lighting..."
							rows={3}
							disabled={isGenerating}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={handleEnhance}
							disabled={!prompt.trim() || isEnhancing || isGenerating}
							className="self-start"
						>
							{isEnhancing ? (
								<>
									<Spinner className="size-3 mr-1" />
									Enhancing...
								</>
							) : (
								<>
									<HugeiconsIcon
										icon={SparklesIcon}
										className="size-3 mr-1"
									/>
									Enhance with AI
								</>
							)}
						</Button>
					</div>

					{/* Enhanced prompt */}
					{enhancedPrompt && (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Label className="text-xs">Enhanced Prompt</Label>
								<Badge
									variant="secondary"
									className="text-[10px] px-1.5 py-0"
								>
									AI Enhanced
								</Badge>
							</div>
							<Textarea
								value={enhancedPrompt}
								onChange={(e) => setEnhancedPrompt(e.target.value)}
								rows={3}
								disabled={isGenerating}
								className="text-xs"
							/>
						</div>
					)}

					{/* Model selector */}
					{models.length > 1 && (
						<div className="flex items-center gap-3">
							<Label className="text-xs w-16 shrink-0">Model</Label>
							<Select
								value={selectedModel}
								onValueChange={setSelectedModel}
								disabled={isGenerating}
							>
								<SelectTrigger className="flex-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{models.map((model) => (
										<SelectItem key={model.id} value={model.id}>
											{model.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Aspect ratio */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-16 shrink-0">Size</Label>
						<div className="flex gap-1.5 flex-1">
							{ASPECT_RATIOS.map((ar) => (
								<Button
									key={ar.value}
									variant={
										aspectRatio === ar.value ? "default" : "outline"
									}
									size="sm"
									onClick={() => setAspectRatio(ar.value)}
									disabled={isGenerating}
									className="flex-1 text-xs"
								>
									<span className="flex flex-col items-center gap-0.5">
										<span>{ar.value}</span>
										<span className="text-[9px] opacity-60">
											{ar.dimensions}
										</span>
									</span>
								</Button>
							))}
						</div>
					</div>

					{/* Error */}
					{error && (
						<div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
							<p className="text-xs text-destructive">{error}</p>
						</div>
					)}

					{/* Generation progress */}
					{isGenerating && (
						<div className="flex items-center justify-center py-8 gap-3">
							<Spinner className="size-5" />
							<span className="text-sm text-muted-foreground">
								Generating image...
							</span>
						</div>
					)}

					{/* Result preview */}
					{result && !isGenerating && (
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Result</Label>
							<div className="relative rounded-lg overflow-hidden border bg-accent">
								<img
									src={result.url}
									alt="Generated image"
									className="w-full h-auto object-contain max-h-64"
								/>
							</div>
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					{result ? (
						<>
							<Button variant="outline" onClick={handleReset}>
								Generate Another
							</Button>
							<Button onClick={handleAddToTimeline}>
								Add to Timeline
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleGenerate}
								disabled={
									!(enhancedPrompt || prompt).trim() || isGenerating
								}
							>
								{isGenerating ? (
									<>
										<Spinner className="size-3 mr-1" />
										Generating...
									</>
								) : (
									"Generate"
								)}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
