"use client";

import { useCallback } from "react";
import { cn } from "@/utils/ui";
import { PanelView } from "./base-view";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { toast } from "sonner";
import type { TimelineElement } from "@/types/timeline";

interface OverlayPreset {
	id: string;
	name: string;
	description: string;
	category: string;
	apply: (params: {
		editor: ReturnType<typeof useEditor>;
		selectedElement: { trackId: string; element: TimelineElement } | null;
	}) => void;
}

export function OverlaysView() {
	const editor = useEditor();

	const getSelectedElement = useCallback((): {
		trackId: string;
		element: TimelineElement;
	} | null => {
		const selected = editor.selection.getSelectedElements();
		if (selected.length === 0) return null;
		const matched = editor.timeline.getElementsWithTracks({
			elements: [selected[0]],
		});
		if (matched.length === 0) return null;
		return { trackId: matched[0].track.id, element: matched[0].element };
	}, [editor]);

	const handleApplyPreset = useCallback(
		(preset: OverlayPreset) => {
			const selectedElement = getSelectedElement();
			preset.apply({ editor, selectedElement });
		},
		[editor, getSelectedElement],
	);

	return (
		<PanelView title="Overlays">
			<div className="flex flex-col gap-4">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Add overlay layers for picture-in-picture, split screens, and
					compositing. Select a clip first or use presets.
				</p>

				{OVERLAY_CATEGORIES.map((category) => (
					<div key={category.name} className="flex flex-col gap-2">
						<h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
							{category.name}
						</h3>
						<div className="grid grid-cols-2 gap-1.5">
							{category.presets.map((preset) => (
								<button
									key={preset.id}
									type="button"
									onClick={() => handleApplyPreset(preset)}
									className={cn(
										"flex flex-col items-center gap-1.5 rounded-lg border p-2.5",
										"hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer text-center",
									)}
								>
									<div className="size-10 rounded border bg-muted/50 flex items-center justify-center">
										<OverlayIcon preset={preset} />
									</div>
									<span className="text-[10px] font-medium leading-tight">
										{preset.name}
									</span>
								</button>
							))}
						</div>
					</div>
				))}

				<div className="flex flex-col gap-2 pt-2 border-t">
					<h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
						Selected clip
					</h3>
					<div className="grid grid-cols-2 gap-1.5">
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() => applyToSelected(editor, { opacity: 0.5 })}
						>
							50% Opacity
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() => applyToSelected(editor, { opacity: 0.3 })}
						>
							30% Opacity
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() =>
								applyToSelected(editor, { blendMode: "screen" })
							}
						>
							Screen Blend
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() =>
								applyToSelected(editor, { blendMode: "multiply" })
							}
						>
							Multiply Blend
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() =>
								applyToSelected(editor, { blendMode: "overlay" })
							}
						>
							Overlay Blend
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-[10px] h-7"
							onClick={() =>
								applyToSelected(editor, { blendMode: "difference" })
							}
						>
							Difference
						</Button>
					</div>
				</div>
			</div>
		</PanelView>
	);
}

function applyToSelected(
	editor: ReturnType<typeof useEditor>,
	updates: Partial<TimelineElement>,
) {
	const selected = editor.selection.getSelectedElements();
	if (selected.length === 0) {
		toast.error("Select a clip first");
		return;
	}
	editor.timeline.updateElements({
		updates: selected.map(({ trackId, elementId }) => ({
			trackId,
			elementId,
			updates,
		})),
	});
	toast.success("Applied to selected clip");
}

function OverlayIcon({ preset }: { preset: OverlayPreset }) {
	const category = preset.category;
	if (category === "pip") {
		return (
			<div className="relative size-8">
				<div className="absolute inset-0 rounded-sm bg-primary/20 border border-primary/30" />
				<div className="absolute bottom-0.5 right-0.5 size-3 rounded-sm bg-primary/50 border border-primary/60" />
			</div>
		);
	}
	if (category === "split") {
		return (
			<div className="relative size-8 flex">
				<div className="flex-1 rounded-l-sm bg-primary/20 border border-primary/30" />
				<div className="flex-1 rounded-r-sm bg-primary/40 border border-primary/30" />
			</div>
		);
	}
	if (category === "compositing") {
		return (
			<div className="relative size-8">
				<div className="absolute inset-0 rounded-sm bg-primary/15 border border-primary/20" />
				<div className="absolute inset-1 rounded-sm bg-primary/30 border border-primary/40" />
			</div>
		);
	}
	return (
		<div className="size-8 rounded-sm bg-primary/20 border border-primary/30" />
	);
}

// --- Preset Definitions ---

const OVERLAY_CATEGORIES: { name: string; presets: OverlayPreset[] }[] = [
	{
		name: "Picture in Picture",
		presets: [
			{
				id: "pip-bottom-right",
				name: "PiP Bottom Right",
				description: "Small overlay in the bottom-right corner",
				category: "pip",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip to make it a PiP overlay");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.3,
									position: {
										x: canvas.width * 0.32,
										y: canvas.height * 0.32,
									},
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("PiP overlay applied — bottom right");
				},
			},
			{
				id: "pip-bottom-left",
				name: "PiP Bottom Left",
				description: "Small overlay in the bottom-left corner",
				category: "pip",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip to make it a PiP overlay");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.3,
									position: {
										x: -canvas.width * 0.32,
										y: canvas.height * 0.32,
									},
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("PiP overlay applied — bottom left");
				},
			},
			{
				id: "pip-top-right",
				name: "PiP Top Right",
				description: "Small overlay in the top-right corner",
				category: "pip",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip to make it a PiP overlay");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.3,
									position: {
										x: canvas.width * 0.32,
										y: -canvas.height * 0.32,
									},
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("PiP overlay applied — top right");
				},
			},
			{
				id: "pip-center",
				name: "PiP Center",
				description: "Medium overlay centered on screen",
				category: "pip",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip to make it a PiP overlay");
						return;
					}
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.5,
									position: { x: 0, y: 0 },
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("PiP overlay applied — center");
				},
			},
		],
	},
	{
		name: "Split Screen",
		presets: [
			{
				id: "split-left",
				name: "Left Half",
				description: "Scale to fill the left half of the screen",
				category: "split",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.5,
									position: { x: -canvas.width * 0.25, y: 0 },
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("Split screen — left half");
				},
			},
			{
				id: "split-right",
				name: "Right Half",
				description: "Scale to fill the right half of the screen",
				category: "split",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.5,
									position: { x: canvas.width * 0.25, y: 0 },
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("Split screen — right half");
				},
			},
			{
				id: "split-top",
				name: "Top Half",
				description: "Scale to fill the top half",
				category: "split",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.5,
									position: { x: 0, y: -canvas.height * 0.25 },
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("Split screen — top half");
				},
			},
			{
				id: "split-bottom",
				name: "Bottom Half",
				description: "Scale to fill the bottom half",
				category: "split",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a video clip");
						return;
					}
					const canvas = editor.project.getActive().settings.canvasSize;
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								transform: {
									scale: 0.5,
									position: { x: 0, y: canvas.height * 0.25 },
									rotate: 0,
								},
								opacity: 1,
							},
						}],
					});
					toast.success("Split screen — bottom half");
				},
			},
		],
	},
	{
		name: "Compositing",
		presets: [
			{
				id: "ghost-overlay",
				name: "Ghost Overlay",
				description: "Semi-transparent overlay with screen blend",
				category: "compositing",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a clip");
						return;
					}
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								opacity: 0.4,
								blendMode: "screen",
								transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							},
						}],
					});
					toast.success("Ghost overlay applied");
				},
			},
			{
				id: "dark-overlay",
				name: "Dark Overlay",
				description: "Darken blend for moody compositing",
				category: "compositing",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a clip");
						return;
					}
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								opacity: 0.6,
								blendMode: "multiply",
								transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							},
						}],
					});
					toast.success("Dark overlay applied");
				},
			},
			{
				id: "light-leak",
				name: "Light Leak",
				description: "Bright overlay with color dodge blend",
				category: "compositing",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a clip");
						return;
					}
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								opacity: 0.35,
								blendMode: "color-dodge",
								transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							},
						}],
					});
					toast.success("Light leak overlay applied");
				},
			},
			{
				id: "reset-overlay",
				name: "Reset to Normal",
				description: "Reset to full size, normal blend, full opacity",
				category: "compositing",
				apply: ({ editor, selectedElement }) => {
					if (!selectedElement) {
						toast.error("Select a clip");
						return;
					}
					editor.timeline.updateElements({
						updates: [{
							trackId: selectedElement.trackId,
							elementId: selectedElement.element.id,
							updates: {
								opacity: 1,
								blendMode: "normal",
								transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							},
						}],
					});
					toast.success("Reset to normal");
				},
			},
		],
	},
];
