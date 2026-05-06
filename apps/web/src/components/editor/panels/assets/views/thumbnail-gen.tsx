"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image02Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { useThumbnailGen } from "@/hooks/use-thumbnail-gen";
import {
	THUMBNAIL_STYLES,
	THUMBNAIL_SIZES,
	COLOR_SCHEMES,
	DEFAULT_THUMBNAIL_PARAMS,
	type ThumbnailGenParams,
} from "@/lib/thumbnail/thumbnail-gen-types";

export function ThumbnailGenPanel({ className }: { className?: string }) {
	const { generate, addToTimeline, generatedThumbnails, clearThumbnails } = useThumbnailGen();
	const [params, setParams] = useState<ThumbnailGenParams>(DEFAULT_THUMBNAIL_PARAMS);
	const [count, setCount] = useState(1);
	const [isGenerating, setIsGenerating] = useState(false);

	const handleGenerate = useCallback(async () => {
		setIsGenerating(true);
		try {
			await generate(params, count);
		} finally {
			setIsGenerating(false);
		}
	}, [generate, params, count]);

	const selectedSize = THUMBNAIL_SIZES.find(
		(s) => s.width === params.width && s.height === params.height,
	) ?? THUMBNAIL_SIZES[0];

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Image02Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">AI Thumbnail Generator</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Generate eye-catching thumbnails for your videos.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1 overflow-y-auto">
				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Description</span>
					<textarea
						className="w-full rounded border bg-transparent px-2 py-1 text-[10px] resize-none h-14 placeholder:text-muted-foreground"
						placeholder="Describe the thumbnail you want (or leave blank to auto-generate from transcript)..."
						value={params.prompt}
						onChange={(e) => setParams((p) => ({ ...p, prompt: e.target.value }))}
					/>
				</div>

				{params.includeText && (
					<div className="space-y-1.5">
						<span className="text-[10px] text-muted-foreground">Headline Text</span>
						<input
							className="w-full rounded border bg-transparent px-2 py-1 text-[10px] placeholder:text-muted-foreground"
							placeholder="e.g., TOP 10 TIPS"
							value={params.headline}
							onChange={(e) => setParams((p) => ({ ...p, headline: e.target.value }))}
						/>
					</div>
				)}

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Style</span>
					<div className="grid grid-cols-2 gap-1">
						{THUMBNAIL_STYLES.map((style) => (
							<button
								key={style.value}
								type="button"
								className={cn(
									"rounded border p-1.5 text-left transition-colors",
									params.style === style.value
										? "border-primary bg-primary/5"
										: "hover:bg-accent/50",
								)}
								onClick={() =>
									setParams((p) => ({ ...p, style: style.value as ThumbnailGenParams["style"] }))
								}
							>
								<span className="text-[10px] font-medium block">{style.label}</span>
								<span className="text-[8px] text-muted-foreground">{style.desc}</span>
							</button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Size</span>
					<div className="grid grid-cols-2 gap-1">
						{THUMBNAIL_SIZES.map((size) => (
							<Button
								key={`${size.width}x${size.height}`}
								variant={
									params.width === size.width && params.height === size.height
										? "secondary"
										: "ghost"
								}
								size="sm"
								className="h-auto py-1 text-[9px] flex flex-col"
								onClick={() => setParams((p) => ({ ...p, width: size.width, height: size.height }))}
							>
								<span>{size.label}</span>
								<span className="text-[7px] text-muted-foreground">
									{size.width}x{size.height}
								</span>
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Colors</span>
					<div className="flex flex-wrap gap-1">
						{COLOR_SCHEMES.map((scheme) => (
							<Button
								key={scheme.value}
								variant={params.colorScheme === scheme.value ? "secondary" : "ghost"}
								size="sm"
								className="h-5 text-[8px] px-1.5"
								onClick={() =>
									setParams((p) => ({
										...p,
										colorScheme: scheme.value as ThumbnailGenParams["colorScheme"],
									}))
								}
							>
								{scheme.label}
							</Button>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant={params.includeText ? "secondary" : "ghost"}
						size="sm"
						className="h-6 text-[9px]"
						onClick={() => setParams((p) => ({ ...p, includeText: !p.includeText }))}
					>
						Text Overlay {params.includeText ? "On" : "Off"}
					</Button>
				</div>

				<div className="space-y-1.5">
					<div className="flex justify-between text-[10px] text-muted-foreground">
						<span>Variations</span>
						<span className="font-mono">{count}</span>
					</div>
					<Slider
						value={[count]}
						onValueChange={([v]) => setCount(v)}
						min={1}
						max={4}
						step={1}
					/>
				</div>

				<Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
					{isGenerating
						? "Generating..."
						: `Generate ${count} Thumbnail${count > 1 ? "s" : ""}`}
				</Button>

				{generatedThumbnails.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-medium text-muted-foreground">
								Generated ({generatedThumbnails.length})
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-5 text-[8px] text-muted-foreground"
								onClick={clearThumbnails}
							>
								<HugeiconsIcon icon={Delete02Icon} className="size-3 mr-1" />
								Clear
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-1.5">
							{generatedThumbnails.map((thumb, i) => (
								<div key={`${thumb.seed}-${i}`} className="rounded border overflow-hidden group">
									<img
										src={thumb.imageUrl}
										alt={`Thumbnail ${i + 1}`}
										className="w-full aspect-video object-cover"
									/>
									<div className="p-1">
										<Button
											size="sm"
											variant="outline"
											className="w-full h-5 text-[8px]"
											onClick={() =>
												addToTimeline(thumb, `Thumbnail ${i + 1}`)
											}
										>
											<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
											Add to Timeline
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
