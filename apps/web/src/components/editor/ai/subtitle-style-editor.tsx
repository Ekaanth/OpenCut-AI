"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon, TextIcon } from "@hugeicons/core-free-icons";

// ----- Types -----

export type SubtitlePosition = "top" | "center" | "bottom";
export type SubtitleAnimation = "none" | "fade" | "slide" | "typewriter" | "bounce" | "karaoke";

export interface SubtitleStyle {
	fontFamily: string;
	fontSize: number;
	textColor: string;
	backgroundColor: string;
	backgroundOpacity: number;
	outlineColor: string;
	outlineWidth: number;
	position: SubtitlePosition;
	animation: SubtitleAnimation;
}

export interface SubtitlePreset {
	id: string;
	name: string;
	description: string;
	style: SubtitleStyle;
	thumbnail?: string;
}

const DEFAULT_PRESETS: SubtitlePreset[] = [
	{
		id: "capcut",
		name: "CapCut",
		description: "Bold, eye-catching style",
		style: {
			fontFamily: "Inter",
			fontSize: 28,
			textColor: "#FFFFFF",
			backgroundColor: "#000000",
			backgroundOpacity: 0.7,
			outlineColor: "#000000",
			outlineWidth: 2,
			position: "bottom",
			animation: "bounce",
		},
	},
	{
		id: "classic",
		name: "Classic",
		description: "Traditional subtitle style",
		style: {
			fontFamily: "Arial",
			fontSize: 22,
			textColor: "#FFFFFF",
			backgroundColor: "#000000",
			backgroundOpacity: 0.5,
			outlineColor: "#000000",
			outlineWidth: 1,
			position: "bottom",
			animation: "fade",
		},
	},
	{
		id: "modern",
		name: "Modern",
		description: "Clean, minimal style",
		style: {
			fontFamily: "Inter",
			fontSize: 24,
			textColor: "#FFFFFF",
			backgroundColor: "transparent",
			backgroundOpacity: 0,
			outlineColor: "#000000",
			outlineWidth: 2,
			position: "bottom",
			animation: "slide",
		},
	},
	{
		id: "karaoke",
		name: "Karaoke",
		description: "Word-by-word highlight",
		style: {
			fontFamily: "Impact",
			fontSize: 32,
			textColor: "#FFFF00",
			backgroundColor: "transparent",
			backgroundOpacity: 0,
			outlineColor: "#000000",
			outlineWidth: 3,
			position: "center",
			animation: "karaoke",
		},
	},
];

const FONT_OPTIONS = [
	"Inter",
	"Arial",
	"Helvetica",
	"Impact",
	"Georgia",
	"Courier New",
	"Comic Sans MS",
	"Verdana",
	"Trebuchet MS",
];

const ANIMATION_OPTIONS: { value: SubtitleAnimation; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "fade", label: "Fade" },
	{ value: "slide", label: "Slide" },
	{ value: "typewriter", label: "Typewriter" },
	{ value: "bounce", label: "Bounce" },
	{ value: "karaoke", label: "Karaoke" },
];

// ----- Props -----

interface SubtitleStyleEditorProps {
	style: SubtitleStyle;
	onStyleChange: (style: SubtitleStyle) => void;
	onGenerate: () => void;
	onApply: () => void;
	isGenerating?: boolean;
	isApplying?: boolean;
	previewText?: string;
	className?: string;
}

// ----- Component -----

export function SubtitleStyleEditor({
	style,
	onStyleChange,
	onGenerate,
	onApply,
	isGenerating = false,
	isApplying = false,
	previewText = "The quick brown fox jumps over the lazy dog",
	className,
}: SubtitleStyleEditorProps) {
	const [activePreset, setActivePreset] = useState<string | null>(null);
	const [isCustom, setIsCustom] = useState(false);

	const handlePresetSelect = (preset: SubtitlePreset) => {
		setActivePreset(preset.id);
		setIsCustom(false);
		onStyleChange(preset.style);
	};

	const handleStyleChange = (updates: Partial<SubtitleStyle>) => {
		setActivePreset(null);
		setIsCustom(true);
		onStyleChange({ ...style, ...updates });
	};

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Live preview */}
			<div className="relative bg-black/90 rounded-lg overflow-hidden aspect-video flex items-end">
				<div
					className={cn(
						"w-full p-4 text-center",
						style.position === "top" && "absolute top-4",
						style.position === "center" &&
							"absolute top-1/2 -translate-y-1/2",
						style.position === "bottom" && "mb-0",
					)}
				>
					<span
						style={{
							fontFamily: style.fontFamily,
							fontSize: `${Math.min(style.fontSize, 32)}px`,
							color: style.textColor,
							backgroundColor:
								style.backgroundOpacity > 0
									? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255)
											.toString(16)
											.padStart(2, "0")}`
									: "transparent",
							WebkitTextStroke: style.outlineWidth > 0
								? `${style.outlineWidth}px ${style.outlineColor}`
								: undefined,
							padding: "4px 8px",
							borderRadius: "4px",
						}}
						className="inline-block"
					>
						{previewText}
					</span>
				</div>
			</div>

			{/* Presets */}
			<div>
				<Label className="text-xs text-muted-foreground mb-2 block">
					Presets
				</Label>
				<div className="grid grid-cols-2 gap-2">
					{DEFAULT_PRESETS.map((preset) => (
						<Card
							key={preset.id}
							className={cn(
								"cursor-pointer transition-colors hover:bg-accent rounded-lg",
								activePreset === preset.id &&
									"ring-2 ring-primary",
							)}
							onClick={() => handlePresetSelect(preset)}
						>
							<CardContent className="p-3">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium">
										{preset.name}
									</span>
									{activePreset === preset.id && (
										<HugeiconsIcon
											icon={Tick01Icon}
											className="size-3 text-primary"
										/>
									)}
								</div>
								<p className="text-[10px] text-muted-foreground mt-0.5">
									{preset.description}
								</p>
							</CardContent>
						</Card>
					))}

					{/* Custom */}
					<Card
						className={cn(
							"cursor-pointer transition-colors hover:bg-accent rounded-lg",
							isCustom && "ring-2 ring-primary",
						)}
						onClick={() => setIsCustom(true)}
					>
						<CardContent className="p-3">
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium">Custom</span>
								{isCustom && (
									<HugeiconsIcon
										icon={Tick01Icon}
										className="size-3 text-primary"
									/>
								)}
							</div>
							<p className="text-[10px] text-muted-foreground mt-0.5">
								Full customization
							</p>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Custom controls */}
			{(isCustom || activePreset !== null) && (
				<div className="flex flex-col gap-3 border-t pt-3">
					{/* Font */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Font</Label>
						<Select
							value={style.fontFamily}
							onValueChange={(v) =>
								handleStyleChange({ fontFamily: v })
							}
						>
							<SelectTrigger className="flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FONT_OPTIONS.map((font) => (
									<SelectItem key={font} value={font}>
										<span style={{ fontFamily: font }}>{font}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Font size */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Size</Label>
						<Slider
							value={[style.fontSize]}
							onValueChange={([v]) =>
								handleStyleChange({ fontSize: v })
							}
							min={12}
							max={64}
							step={1}
							className="flex-1"
						/>
						<span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
							{style.fontSize}
						</span>
					</div>

					{/* Text color */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Color</Label>
						<div className="flex items-center gap-2 flex-1">
							<input
								type="color"
								value={style.textColor}
								onChange={(e) =>
									handleStyleChange({ textColor: e.target.value })
								}
								className="size-7 rounded-sm border cursor-pointer"
							/>
							<Input
								value={style.textColor}
								onChange={(e) =>
									handleStyleChange({ textColor: e.target.value })
								}
								size="xs"
								className="flex-1 font-mono"
							/>
						</div>
					</div>

					{/* Background color */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Background</Label>
						<div className="flex items-center gap-2 flex-1">
							<input
								type="color"
								value={
									style.backgroundColor === "transparent"
										? "#000000"
										: style.backgroundColor
								}
								onChange={(e) =>
									handleStyleChange({
										backgroundColor: e.target.value,
									})
								}
								className="size-7 rounded-sm border cursor-pointer"
							/>
							<Slider
								value={[style.backgroundOpacity]}
								onValueChange={([v]) =>
									handleStyleChange({ backgroundOpacity: v })
								}
								min={0}
								max={1}
								step={0.05}
								className="flex-1"
							/>
						</div>
					</div>

					{/* Outline */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Outline</Label>
						<div className="flex items-center gap-2 flex-1">
							<input
								type="color"
								value={style.outlineColor}
								onChange={(e) =>
									handleStyleChange({ outlineColor: e.target.value })
								}
								className="size-7 rounded-sm border cursor-pointer"
							/>
							<Slider
								value={[style.outlineWidth]}
								onValueChange={([v]) =>
									handleStyleChange({ outlineWidth: v })
								}
								min={0}
								max={5}
								step={0.5}
								className="flex-1"
							/>
						</div>
					</div>

					{/* Position */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Position</Label>
						<div className="flex gap-1 flex-1">
							{(["top", "center", "bottom"] as SubtitlePosition[]).map(
								(pos) => (
									<Button
										key={pos}
										variant={
											style.position === pos ? "default" : "outline"
										}
										size="sm"
										onClick={() =>
											handleStyleChange({ position: pos })
										}
										className="flex-1 capitalize text-xs h-7"
									>
										{pos}
									</Button>
								),
							)}
						</div>
					</div>

					{/* Animation */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Animation</Label>
						<Select
							value={style.animation}
							onValueChange={(v: SubtitleAnimation) =>
								handleStyleChange({ animation: v })
							}
						>
							<SelectTrigger className="flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ANIMATION_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{/* Action buttons */}
			<div className="flex items-center gap-2 border-t pt-3">
				<Button
					variant="outline"
					onClick={onGenerate}
					disabled={isGenerating}
					className="flex-1"
				>
					{isGenerating ? (
						<>
							<Spinner className="size-3 mr-1" />
							Generating...
						</>
					) : (
						<>
							<HugeiconsIcon icon={TextIcon} className="size-3 mr-1" />
							Generate Subtitles
						</>
					)}
				</Button>
				<Button
					variant="default"
					onClick={onApply}
					disabled={isApplying}
					className="flex-1"
				>
					{isApplying ? (
						<>
							<Spinner className="size-3 mr-1" />
							Applying...
						</>
					) : (
						"Apply Style"
					)}
				</Button>
			</div>
		</div>
	);
}
