"use client";

import { useCallback, useRef, useState } from "react";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { toast } from "sonner";
import type { TextElement } from "@/types/timeline";

interface TextPreset {
	id: string;
	name: string;
	preview: string;
	config: Partial<Omit<TextElement, "type" | "id">>;
}

const TEXT_PRESETS: TextPreset[] = [
	{
		id: "heading",
		name: "Heading",
		preview: "Heading",
		config: {
			content: "Heading",
			fontSize: 24,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#FFFFFF",
		},
	},
	{
		id: "subheading",
		name: "Subheading",
		preview: "Subheading",
		config: {
			content: "Subheading",
			fontSize: 16,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#E2E8F0",
		},
	},
	{
		id: "body",
		name: "Body Text",
		preview: "Body text",
		config: {
			content: "Body text",
			fontSize: 10,
			fontWeight: "normal",
			fontFamily: "Inter",
			color: "#FFFFFF",
		},
	},
	{
		id: "caption",
		name: "Caption",
		preview: "Caption",
		config: {
			content: "Caption",
			fontSize: 6,
			fontWeight: "normal",
			fontFamily: "Inter",
			color: "#94A3B8",
		},
	},
	{
		id: "bold-impact",
		name: "Bold Impact",
		preview: "IMPACT",
		config: {
			content: "IMPACT",
			fontSize: 30,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#EF4444",
		},
	},
	{
		id: "outlined",
		name: "Outlined",
		preview: "Outlined",
		config: {
			content: "Outlined",
			fontSize: 20,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#FFFFFF",
			background: {
				enabled: true,
				color: "transparent",
				cornerRadius: 0,
				paddingX: 0,
				paddingY: 0,
				offsetX: 0,
				offsetY: 0,
			},
		},
	},
	{
		id: "label-badge",
		name: "Label / Badge",
		preview: "LABEL",
		config: {
			content: "LABEL",
			fontSize: 5,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#FFFFFF",
			background: {
				enabled: true,
				color: "#3B82F6",
				cornerRadius: 50,
				paddingX: 20,
				paddingY: 8,
				offsetX: 0,
				offsetY: 0,
			},
		},
	},
	{
		id: "lower-third",
		name: "Lower Third",
		preview: "Name | Title",
		config: {
			content: "Name | Title",
			fontSize: 6,
			fontWeight: "bold",
			fontFamily: "Inter",
			color: "#FFFFFF",
			background: {
				enabled: true,
				color: "#000000",
				cornerRadius: 4,
				paddingX: 16,
				paddingY: 8,
				offsetX: 0,
				offsetY: 0,
			},
			transform: {
				scale: 1,
				position: { x: 0, y: 200 },
				rotate: 0,
			},
		},
	},
	{
		id: "default",
		name: "Default",
		preview: "Default text",
		config: {},
	},
];

export function TextView() {
	const editor = useEditor();
	const fontInputRef = useRef<HTMLInputElement>(null);
	const [uploadedFonts, setUploadedFonts] = useState<string[]>(() => {
		if (typeof window === "undefined") return [];
		try {
			const stored = localStorage.getItem("opencut:custom-fonts");
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});

	const handleAddPreset = useCallback(
		(preset: TextPreset, currentTime: number) => {
			const element = buildTextElement({
				raw: { ...DEFAULT_TEXT_ELEMENT, ...preset.config },
				startTime: currentTime,
			});
			editor.timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		},
		[editor],
	);

	const handleFontUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (!files || files.length === 0) return;

			const loaded: string[] = [];

			for (const file of Array.from(files)) {
				if (
					!file.name.endsWith(".ttf") &&
					!file.name.endsWith(".otf") &&
					!file.name.endsWith(".woff") &&
					!file.name.endsWith(".woff2")
				) {
					toast.error(`${file.name}: unsupported format. Use TTF, OTF, WOFF, or WOFF2.`);
					continue;
				}

				try {
					const fontName = file.name.replace(/\.(ttf|otf|woff2?)$/i, "");
					const buffer = await file.arrayBuffer();
					const fontFace = new FontFace(fontName, buffer);
					await fontFace.load();
					document.fonts.add(fontFace);
					loaded.push(fontName);
				} catch (err) {
					toast.error(`Failed to load ${file.name}`);
					console.error("Font load error:", err);
				}
			}

			if (loaded.length > 0) {
				const updated = [...new Set([...uploadedFonts, ...loaded])];
				setUploadedFonts(updated);
				try {
					localStorage.setItem("opencut:custom-fonts", JSON.stringify(updated));
				} catch { /* ignore */ }
				toast.success(`Loaded ${loaded.length} font${loaded.length > 1 ? "s" : ""}: ${loaded.join(", ")}`);
			}

			// Reset input
			if (fontInputRef.current) fontInputRef.current.value = "";
		},
		[uploadedFonts],
	);

	return (
		<PanelView title="Text">
			<div className="flex flex-col gap-4 pb-4">
				{/* Text presets */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs font-medium">Text presets</Label>
					<div className="grid grid-cols-2 gap-1.5">
						{TEXT_PRESETS.map((preset) => (
							<DraggableItem
								key={preset.id}
								name={preset.name}
								preview={
									<div className="bg-accent flex size-full items-center justify-center rounded p-2">
										<span
											className="select-none truncate"
											style={{
												fontSize: Math.min(14, (preset.config.fontSize ?? 10) * 0.8),
												fontWeight: preset.config.fontWeight ?? "normal",
												color: preset.config.color ?? "#ffffff",
												fontFamily: preset.config.fontFamily ?? "Inter",
											}}
										>
											{preset.preview}
										</span>
									</div>
								}
								dragData={{
									id: `temp-text-${preset.id}`,
									type: "text",
									name: preset.name,
									content: preset.config.content ?? "Text",
								}}
								aspectRatio={2}
								onAddToTimeline={({ currentTime }) =>
									handleAddPreset(preset, currentTime)
								}
								shouldShowLabel
							/>
						))}
					</div>
				</div>

				{/* Font upload */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Custom fonts</Label>
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Upload TTF, OTF, WOFF, or WOFF2 font files to use in your project.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() => fontInputRef.current?.click()}
					>
						Upload fonts
					</Button>
					<input
						ref={fontInputRef}
						type="file"
						accept=".ttf,.otf,.woff,.woff2"
						multiple
						className="hidden"
						onChange={handleFontUpload}
					/>

					{uploadedFonts.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-1">
							{uploadedFonts.map((font) => (
								<span
									key={font}
									className="text-[10px] rounded-full border px-2 py-0.5 text-muted-foreground"
									style={{ fontFamily: font }}
								>
									{font}
								</span>
							))}
						</div>
					)}
				</div>
			</div>
		</PanelView>
	);
}
