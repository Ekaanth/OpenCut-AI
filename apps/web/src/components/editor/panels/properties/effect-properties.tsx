"use client";

import type { EffectElement } from "@/types/timeline";
import type { EffectParamDefinition } from "@/types/effects";
import { getEffect } from "@/lib/effects/registry";
import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { Section, SectionContent, SectionHeader, SectionField, SectionFields } from "./section";
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/ui/number-field";
import { usePropertyDraft } from "./hooks/use-property-draft";

function EffectParamField({
	param,
	element,
	trackId,
}: {
	param: EffectParamDefinition;
	element: EffectElement;
	trackId: string;
}) {
	const editor = useEditor();

	const currentValue = Number(element.params[param.key] ?? param.default);
	const min = param.min ?? 0;
	const max = param.max ?? 100;
	const step = param.step ?? 1;

	const updateParam = (value: number) =>
		editor.timeline.previewElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { params: { ...element.params, [param.key]: value } },
				},
			],
		});

	const commitParam = () => editor.timeline.commitPreview();

	const draft = usePropertyDraft({
		displayValue: String(currentValue),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min, max });
		},
		onPreview: updateParam,
		onCommit: commitParam,
	});

	return (
		<SectionField label={param.label}>
			<div className="flex items-center gap-3">
				<Slider
					className="flex-1"
					min={min}
					max={max}
					step={step}
					value={[currentValue]}
					onValueChange={([value]) => updateParam(value)}
					onValueCommit={commitParam}
				/>
				<NumberField
					className="w-16 shrink-0"
					value={draft.displayValue}
					onFocus={draft.onFocus}
					onChange={draft.onChange}
					onBlur={draft.onBlur}
				/>
			</div>
		</SectionField>
	);
}

export function EffectProperties({
	element,
	trackId,
}: {
	element: EffectElement;
	trackId: string;
}) {
	const definition = getEffect({ effectType: element.effectType });

	return (
		<Section hasBorderTop={false}>
			<SectionHeader title={definition.name} />
			<SectionContent>
				<SectionFields>
					{definition.params.map((param) => (
						<EffectParamField
							key={param.key}
							param={param}
							element={element}
							trackId={trackId}
						/>
					))}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
