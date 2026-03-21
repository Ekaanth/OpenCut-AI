"use client";

import { useCallback } from "react";
import { cn } from "@/utils/ui";
import { PanelView } from "./base-view";
import { useEditor } from "@/hooks/use-editor";
import { FILTER_PRESETS, type FilterPreset, colorAdjustEffectDefinition } from "@/lib/effects/definitions/color-adjust";
import { hasEffect, registerEffect } from "@/lib/effects/registry";
import { buildEffectElement } from "@/lib/timeline/element-utils";
import { toast } from "sonner";

export function FiltersView() {
	const editor = useEditor();

	// Ensure color-adjust effect is registered
	if (!hasEffect({ effectType: "color-adjust" })) {
		registerEffect({ definition: colorAdjustEffectDefinition });
	}

	const handleApplyFilter = useCallback(
		(preset: FilterPreset) => {
			// Use the selected clip's time range, or fall back to playhead position
			const selected = editor.selection.getSelectedElements();
			let startTime: number;
			let duration: number;

			if (selected.length > 0) {
				const matched = editor.timeline.getElementsWithTracks({ elements: selected });
				if (matched.length > 0) {
					const el = matched[0].element;
					startTime = el.startTime;
					duration = el.duration;
				} else {
					startTime = editor.playback.getCurrentTime();
					duration = 5;
				}
			} else {
				startTime = editor.playback.getCurrentTime();
				duration = 5;
			}

			const element = buildEffectElement({
				effectType: "color-adjust",
				startTime,
				duration,
			});

			element.params = { ...preset.params };
			element.name = `Filter: ${preset.name}`;

			editor.timeline.insertElement({
				placement: { mode: "auto", trackType: "effect" },
				element,
			});

			toast.success(`"${preset.name}" filter added to selected clip`);
		},
		[editor],
	);

	return (
		<PanelView title="Filters">
			<div className="flex flex-col gap-3">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Click a filter to add it as a track. Select and delete it from the timeline to remove.
				</p>

				<div className="grid grid-cols-2 gap-2">
					{FILTER_PRESETS.map((preset) => (
						<button
							key={preset.id}
							type="button"
							onClick={() => handleApplyFilter(preset)}
							className={cn(
								"group relative flex flex-col items-center gap-1.5 rounded-lg border p-3",
								"hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer",
							)}
						>
							<div
								className="size-12 rounded-md border"
								style={{
									background: getFilterPreviewGradient(preset),
								}}
							/>
							<span className="text-[11px] font-medium">{preset.name}</span>
						</button>
					))}
				</div>
			</div>
		</PanelView>
	);
}

function getFilterPreviewGradient(preset: FilterPreset): string {
	const { brightness, contrast, saturation, temperature } = preset.params;

	const warmth = temperature > 0 ? temperature * 40 : 0;
	const coolness = temperature < 0 ? Math.abs(temperature) * 40 : 0;
	const r = Math.round(Math.min(255, Math.max(0, 128 + brightness * 200 + warmth + (contrast - 1) * 30)));
	const g = Math.round(Math.min(255, Math.max(0, 128 + brightness * 200 + (contrast - 1) * 20)));
	const b = Math.round(Math.min(255, Math.max(0, 128 + brightness * 200 + coolness + (contrast - 1) * 30)));

	if (saturation < 0.1) {
		const gray = Math.round(128 + brightness * 200);
		return `linear-gradient(135deg, rgb(${gray},${gray},${gray}), rgb(${Math.max(0, gray - 40)},${Math.max(0, gray - 40)},${Math.max(0, gray - 40)}))`;
	}

	return `linear-gradient(135deg, rgb(${r},${g},${b}), rgb(${Math.max(0, r - 50)},${Math.max(0, g - 30)},${Math.max(0, b - 50)}))`;
}
