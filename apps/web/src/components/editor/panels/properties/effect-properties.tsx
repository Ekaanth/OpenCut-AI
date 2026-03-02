"use client";

import type { EffectElement } from "@/types/timeline";
import { getEffect } from "@/lib/effects/registry";
import { useEditor } from "@/hooks/use-editor";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionFields,
	SectionTitle,
} from "./section";
import { EffectParamField } from "./effect-param-field";

export function EffectProperties({
	element,
	trackId,
}: {
	element: EffectElement;
	trackId: string;
}) {
	const editor = useEditor();
	const definition = getEffect({ effectType: element.effectType });

	const previewParam =
		({ key }: { key: string }) =>
		(value: number | string | boolean) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { params: { ...element.params, [key]: value } },
					},
				],
			});

	return (
		<Section showTopBorder={false}>
			<SectionHeader>
				<SectionTitle>{definition.name}</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					{definition.params.map((param) => (
						<EffectParamField
							key={param.key}
							param={param}
							value={element.params[param.key] ?? param.default}
							onPreview={previewParam({ key: param.key })}
							onCommit={() => editor.timeline.commitPreview()}
						/>
					))}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
