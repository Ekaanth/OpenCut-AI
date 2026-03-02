import { useEditor } from "@/hooks/use-editor";
import {
	getKeyframeAtTime,
	hasKeyframesForPath,
	upsertElementKeyframe,
} from "@/lib/animation";
import type { AnimationPropertyPath, ElementAnimations } from "@/types/animation";
import type { TimelineElement } from "@/types/timeline";

export function useKeyframedColorProperty({
	trackId,
	elementId,
	animations,
	propertyPath,
	localTime,
	isPlayheadWithinElementRange,
	resolvedColor,
	buildBaseUpdates,
}: {
	trackId: string;
	elementId: string;
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	localTime: number;
	isPlayheadWithinElementRange: boolean;
	resolvedColor: string;
	buildBaseUpdates: ({ value }: { value: string }) => Partial<TimelineElement>;
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

	const onChange = ({ color }: { color: string }) => {
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
								value: color,
							}),
						},
					},
				],
			});
			return;
		}

		editor.timeline.previewElements({
			updates: [{ trackId, elementId, updates: buildBaseUpdates({ value: color }) }],
		});
	};

	const onChangeEnd = () => editor.timeline.commitPreview();

	const toggleKeyframe = () => {
		if (!isPlayheadWithinElementRange) {
			return;
		}

		if (keyframeIdAtTime) {
			editor.timeline.removeKeyframes({
				keyframes: [{ trackId, elementId, propertyPath, keyframeId: keyframeIdAtTime }],
			});
			return;
		}

		editor.timeline.upsertKeyframes({
			keyframes: [
				{ trackId, elementId, propertyPath, time: localTime, value: resolvedColor },
			],
		});
	};

	return {
		isKeyframedAtTime,
		hasAnimatedKeyframes,
		keyframeIdAtTime,
		onChange,
		onChangeEnd,
		toggleKeyframe,
	};
}
