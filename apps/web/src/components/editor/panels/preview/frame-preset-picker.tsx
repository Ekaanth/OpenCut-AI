"use client";

import { useEditor } from "@/hooks/use-editor";
import { FRAME_PRESETS } from "@/constants/project-constants";
import { dimensionToAspectRatio } from "@/utils/geometry";
import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimelineElement } from "@/types/timeline";

export function FramePresetPicker() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const currentSize = activeProject.settings.canvasSize;
	const currentRatio = dimensionToAspectRatio(currentSize);

	const handlePresetClick = (preset: (typeof FRAME_PRESETS)[number]) => {
		const oldSize = activeProject.settings.canvasSize;
		const newSize = preset.canvas;

		// Update canvas size
		editor.project.updateSettings({
			settings: { canvasSize: newSize },
		});

		// Rescale text element positions proportionally to the new canvas size
		const scaleX = newSize.width / oldSize.width;
		const scaleY = newSize.height / oldSize.height;

		if (scaleX === 1 && scaleY === 1) return;

		const tracks = editor.timeline.getTracks();
		const updates: {
			trackId: string;
			elementId: string;
			updates: Partial<TimelineElement>;
		}[] = [];

		for (const track of tracks) {
			if (track.type !== "text") continue;
			for (const element of track.elements) {
				if (element.type !== "text") continue;
				const pos = element.transform.position;
				updates.push({
					trackId: track.id,
					elementId: element.id,
					updates: {
						transform: {
							...element.transform,
							position: {
								x: Math.round(pos.x * scaleX),
								y: Math.round(pos.y * scaleY),
							},
						},
					},
				});
			}
		}

		if (updates.length > 0) {
			editor.timeline.updateElements({ updates });
		}
	};

	return (
		<TooltipProvider delayDuration={300}>
			<div className="flex items-center gap-1 px-2 py-1.5">
				{FRAME_PRESETS.map((preset) => {
					const isActive = currentRatio === preset.ratio;
					return (
						<Tooltip key={preset.id}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => handlePresetClick(preset)}
									className={cn(
										"flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors",
										isActive
											? "bg-foreground text-background font-medium"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
								>
									<FrameIcon
										ratio={preset.ratio}
										className={cn(
											"shrink-0",
											isActive
												? "text-background"
												: "text-muted-foreground",
										)}
									/>
									<span>{preset.shortLabel}</span>
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								<p className="font-medium">{preset.label}</p>
								<p className="text-muted-foreground">
									{preset.canvas.width} x {preset.canvas.height}
								</p>
							</TooltipContent>
						</Tooltip>
					);
				})}
			</div>
		</TooltipProvider>
	);
}

function FrameIcon({
	ratio,
	className,
}: {
	ratio: string;
	className?: string;
}) {
	const dimensions: Record<string, { w: number; h: number }> = {
		"16:9": { w: 14, h: 8 },
		"9:16": { w: 8, h: 14 },
		"1:1": { w: 10, h: 10 },
		"4:3": { w: 12, h: 9 },
	};

	const { w, h } = dimensions[ratio] ?? { w: 12, h: 8 };

	return (
		<svg
			width={w}
			height={h}
			viewBox={`0 0 ${w} ${h}`}
			className={className}
		>
			<rect
				x={0.5}
				y={0.5}
				width={w - 1}
				height={h - 1}
				rx={1}
				fill="none"
				stroke="currentColor"
				strokeWidth={1}
			/>
		</svg>
	);
}
