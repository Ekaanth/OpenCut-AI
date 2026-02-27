import { useEditor } from "@/hooks/use-editor";
import {
	getKeyframeAtTime,
	hasKeyframesForPath,
	upsertElementKeyframe,
} from "@/lib/animation";
import type { AnimationPropertyPath, ElementAnimations } from "@/types/animation";
import type { ElementUpdatePatch } from "@/types/timeline";
import { usePropertyDraft } from "./use-property-draft";

export function useKeyframedNumberProperty({
	trackId,
	elementId,
	animations,
	propertyPath,
	localTime,
	isPlayheadWithinElementRange,
	displayValue,
	parse,
	valueAtPlayhead,
	buildBaseUpdates,
}: {
	trackId: string;
	elementId: string;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	localTime: number;
	isPlayheadWithinElementRange: boolean;
	displayValue: string;
	parse: (input: string) => number | null;
	valueAtPlayhead: number;
	buildBaseUpdates: ({ value }: { value: number }) => ElementUpdatePatch;
}) {
	const editor = useEditor();

	const hasAnimatedKeyframes = hasKeyframesForPath({ animations, propertyPath });
	const keyframeAtTime = isPlayheadWithinElementRange
		? getKeyframeAtTime({ animations, propertyPath, time: localTime })
		: null;
	const keyframeIdAtTime = keyframeAtTime?.id ?? null;
	const isKeyframedAtTime = keyframeAtTime !== null;
	const shouldUseAnimatedChannel =
		hasAnimatedKeyframes && isPlayheadWithinElementRange;

	const previewValue = ({ value }: { value: number }) => {
		if (shouldUseAnimatedChannel) {
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId,
						updates: {
							animations: upsertElementKeyframe({
								animations,
								propertyPath,
								time: localTime,
								value,
							}),
						},
					},
				],
			});
			return;
		}

		editor.timeline.previewElements({
			updates: [
				{
					trackId,
					elementId,
					updates: buildBaseUpdates({ value }),
				},
			],
		});
	};

	const propertyDraft = usePropertyDraft({
		displayValue,
		parse,
		onPreview: (value) => previewValue({ value }),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const toggleKeyframe = () => {
		if (!isPlayheadWithinElementRange) {
			return;
		}

		if (keyframeIdAtTime) {
			editor.timeline.removeKeyframes({
				keyframes: [
					{
						trackId,
						elementId,
						propertyPath,
						keyframeId: keyframeIdAtTime,
					},
				],
			});
			return;
		}

		editor.timeline.upsertKeyframes({
			keyframes: [
				{
					trackId,
					elementId,
					propertyPath,
					time: localTime,
					value: valueAtPlayhead,
				},
			],
		});
	};

	const commitValue = ({ value }: { value: number }) => {
		if (shouldUseAnimatedChannel) {
			editor.timeline.upsertKeyframes({
				keyframes: [
					{
						trackId,
						elementId,
						propertyPath,
						time: localTime,
						value,
					},
				],
			});
			return;
		}

		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId,
					updates: buildBaseUpdates({ value }),
				},
			],
		});
	};

	return {
		...propertyDraft,
		hasAnimatedKeyframes,
		isKeyframedAtTime,
		keyframeIdAtTime,
		toggleKeyframe,
		commitValue,
	};
}
