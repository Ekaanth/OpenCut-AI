"use client";

import { useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, Upload04Icon } from "@hugeicons/core-free-icons";

// ----- Types -----

interface BackgroundRemovalResult {
	originalUrl: string;
	processedUrl: string;
	width: number;
	height: number;
}

interface BackgroundRemovalDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onRemoveBackground: (
		source: File | string,
	) => Promise<BackgroundRemovalResult | null>;
	onAddToTimeline: (result: BackgroundRemovalResult) => void;
	timelineFrames?: { id: string; url: string; name: string }[];
	className?: string;
}

// ----- Component -----

export function BackgroundRemovalDialog({
	isOpen,
	onOpenChange,
	onRemoveBackground,
	onAddToTimeline,
	timelineFrames = [],
}: BackgroundRemovalDialogProps) {
	const [source, setSource] = useState<File | string | null>(null);
	const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [result, setResult] = useState<BackgroundRemovalResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [comparisonPosition, setComparisonPosition] = useState(50);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const sliderContainerRef = useRef<HTMLDivElement>(null);

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setSource(file);
		setSourcePreviewUrl(URL.createObjectURL(file));
		setResult(null);
		setError(null);
	};

	const handleTimelineSelect = (url: string) => {
		setSource(url);
		setSourcePreviewUrl(url);
		setResult(null);
		setError(null);
	};

	const handleProcess = async () => {
		if (!source) return;
		setIsProcessing(true);
		setError(null);

		try {
			const processed = await onRemoveBackground(source);
			setResult(processed);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to remove background",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleSliderDrag = (e: React.MouseEvent) => {
		const container = sliderContainerRef.current;
		if (!container) return;

		const updatePosition = (clientX: number) => {
			const rect = container.getBoundingClientRect();
			const x = clientX - rect.left;
			const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
			setComparisonPosition(percent);
		};

		updatePosition(e.clientX);

		const onMouseMove = (moveEvent: MouseEvent) => {
			updatePosition(moveEvent.clientX);
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	};

	const handleAddToTimeline = () => {
		if (result) {
			onAddToTimeline(result);
			onOpenChange(false);
		}
	};

	const handleReset = () => {
		setSource(null);
		setSourcePreviewUrl(null);
		setResult(null);
		setError(null);
		setComparisonPosition(50);
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
						Remove Background
					</DialogTitle>
					<DialogDescription>
						Upload an image or select from the timeline to remove its
						background.
					</DialogDescription>
				</DialogHeader>

				<DialogBody>
					{/* Source selection */}
					{!source && (
						<div className="flex flex-col gap-4">
							{/* File upload */}
							<div>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleFileUpload}
									className="hidden"
								/>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="w-full flex flex-col items-center gap-3 border-2 border-dashed rounded-lg p-8 hover:bg-accent transition-colors cursor-pointer"
								>
									<HugeiconsIcon
										icon={Upload04Icon}
										className="size-8 text-muted-foreground/50"
									/>
									<div className="text-center">
										<p className="text-sm font-medium">
											Upload Image
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											PNG, JPG, WEBP supported
										</p>
									</div>
								</button>
							</div>

							{/* Timeline frames */}
							{timelineFrames.length > 0 && (
								<div>
									<Label className="text-xs mb-2 block">
										From Timeline
									</Label>
									<div className="grid grid-cols-4 gap-2">
										{timelineFrames.map((frame) => (
											<button
												key={frame.id}
												type="button"
												onClick={() =>
													handleTimelineSelect(frame.url)
												}
												className="relative aspect-video rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all group"
											>
												<img
													src={frame.url}
													alt={frame.name}
													className="w-full h-full object-cover"
												/>
												<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Preview / Comparison */}
					{source && !result && !isProcessing && (
						<div className="flex flex-col gap-4">
							<div className="relative rounded-lg overflow-hidden border bg-accent">
								<img
									src={sourcePreviewUrl ?? ""}
									alt="Source"
									className="w-full h-auto object-contain max-h-64"
								/>
							</div>
						</div>
					)}

					{/* Processing state */}
					{isProcessing && (
						<div className="flex flex-col items-center gap-3 py-8">
							<Spinner className="size-6" />
							<p className="text-sm text-muted-foreground">
								Removing background...
							</p>
						</div>
					)}

					{/* Before/After comparison */}
					{result && (
						<div className="flex flex-col gap-3">
							<Label className="text-xs">Before / After</Label>
							<div
								ref={sliderContainerRef}
								className="relative rounded-lg overflow-hidden border cursor-col-resize select-none"
								onMouseDown={handleSliderDrag}
								role="slider"
								aria-label="Comparison slider"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(comparisonPosition)}
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "ArrowLeft") {
										setComparisonPosition((p) => Math.max(0, p - 2));
									} else if (e.key === "ArrowRight") {
										setComparisonPosition((p) => Math.min(100, p + 2));
									}
								}}
							>
								{/* After (processed - full width underneath) */}
								<div
									className="w-full"
									style={{
										backgroundImage: `
											linear-gradient(45deg, #ccc 25%, transparent 25%),
											linear-gradient(-45deg, #ccc 25%, transparent 25%),
											linear-gradient(45deg, transparent 75%, #ccc 75%),
											linear-gradient(-45deg, transparent 75%, #ccc 75%)
										`,
										backgroundSize: "16px 16px",
										backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
									}}
								>
									<img
										src={result.processedUrl}
										alt="After"
										className="w-full h-auto object-contain max-h-64"
										draggable={false}
									/>
								</div>

								{/* Before (original - clipped) */}
								<div
									className="absolute inset-0 overflow-hidden"
									style={{ width: `${comparisonPosition}%` }}
								>
									<img
										src={result.originalUrl}
										alt="Before"
										className="w-full h-auto object-contain max-h-64"
										style={{
											width: `${(100 / comparisonPosition) * 100}%`,
											maxWidth: "none",
										}}
										draggable={false}
									/>
								</div>

								{/* Slider handle */}
								<div
									className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
									style={{ left: `${comparisonPosition}%` }}
								>
									<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-white shadow-md flex items-center justify-center">
										<div className="flex gap-0.5">
											<div className="w-0.5 h-3 bg-gray-400 rounded-full" />
											<div className="w-0.5 h-3 bg-gray-400 rounded-full" />
										</div>
									</div>
								</div>
							</div>
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>Original</span>
								<span>Background Removed</span>
							</div>
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
							<p className="text-xs text-destructive">{error}</p>
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					{result ? (
						<>
							<Button variant="outline" onClick={handleReset}>
								Try Another
							</Button>
							<Button onClick={handleAddToTimeline}>
								Add to Timeline
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => {
									if (source) {
										handleReset();
									} else {
										onOpenChange(false);
									}
								}}
							>
								{source ? "Back" : "Cancel"}
							</Button>
							{source && (
								<Button
									onClick={handleProcess}
									disabled={isProcessing}
								>
									{isProcessing ? (
										<>
											<Spinner className="size-3 mr-1" />
											Processing...
										</>
									) : (
										"Remove Background"
									)}
								</Button>
							)}
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
