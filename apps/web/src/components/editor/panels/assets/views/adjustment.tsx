"use client";

import { useCallback, useState } from "react";
import { PanelView } from "./base-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEditor } from "@/hooks/use-editor";
import { colorAdjustEffectDefinition } from "@/lib/effects/definitions/color-adjust";
import { hasEffect, registerEffect } from "@/lib/effects/registry";
import { buildEffectElement } from "@/lib/timeline/element-utils";
import { toast } from "sonner";

interface AdjustmentValues {
	brightness: number;
	contrast: number;
	saturation: number;
	temperature: number;
	vignette: number;
}

const DEFAULT_VALUES: AdjustmentValues = {
	brightness: 0,
	contrast: 1,
	saturation: 1,
	temperature: 0,
	vignette: 0,
};

const SLIDERS: {
	key: keyof AdjustmentValues;
	label: string;
	min: number;
	max: number;
	step: number;
	format: (v: number) => string;
}[] = [
	{ key: "brightness", label: "Brightness", min: -0.5, max: 0.5, step: 0.01, format: (v) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%` },
	{ key: "contrast", label: "Contrast", min: 0.2, max: 3, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
	{ key: "saturation", label: "Saturation", min: 0, max: 3, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
	{ key: "temperature", label: "Temperature", min: -1, max: 1, step: 0.01, format: (v) => v < 0 ? `Cool ${Math.round(Math.abs(v) * 100)}` : v > 0 ? `Warm ${Math.round(v * 100)}` : "Neutral" },
	{ key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
];

export function AdjustmentView() {
	const editor = useEditor();
	const [values, setValues] = useState<AdjustmentValues>({ ...DEFAULT_VALUES });

	// Ensure color-adjust effect is registered
	if (!hasEffect({ effectType: "color-adjust" })) {
		registerEffect({ definition: colorAdjustEffectDefinition });
	}

	const handleChange = useCallback(
		(key: keyof AdjustmentValues, value: number) => {
			setValues((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const handleApply = useCallback(() => {
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

		element.params = { ...values };
		element.name = "Adjustment";

		editor.timeline.insertElement({
			placement: { mode: "auto", trackType: "effect" },
			element,
		});

		toast.success("Adjustment added to selected clip");
	}, [editor, values]);

	const handleReset = useCallback(() => {
		setValues({ ...DEFAULT_VALUES });
	}, []);

	return (
		<PanelView title="Adjustment">
			<div className="flex flex-col gap-4">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Adjust values and click Apply to add as a track. Delete from the timeline to remove.
				</p>

				{SLIDERS.map((slider) => (
					<div key={slider.key} className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-xs">{slider.label}</Label>
							<span className="text-[10px] text-muted-foreground tabular-nums">
								{slider.format(values[slider.key])}
							</span>
						</div>
						<input
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={values[slider.key]}
							onChange={(e) => handleChange(slider.key, parseFloat(e.target.value))}
							className="w-full accent-primary h-1.5"
						/>
					</div>
				))}

				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						className="flex-1"
						onClick={handleReset}
					>
						Reset
					</Button>
					<Button
						size="sm"
						className="flex-1"
						onClick={handleApply}
					>
						Apply
					</Button>
				</div>
			</div>
		</PanelView>
	);
}
