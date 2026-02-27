import { EditorCore } from "@/core";
import {
	getChannel,
	getChannelValueAtTime,
	getElementBaseValueForProperty,
	removeElementKeyframe,
	supportsAnimationProperty,
	withElementBaseValueForProperty,
} from "@/lib/animation";
import { Command } from "@/lib/commands/base-command";
import { updateElementInTracks } from "@/lib/timeline";
import type { AnimationPropertyPath } from "@/types/animation";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";

function sampleValueBeforeRemoval({
	element,
	propertyPath,
	keyframeId,
}: {
	element: TimelineElement;
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
}): number | null {
	const channel = getChannel({
		animations: element.animations,
		propertyPath,
	});
	const keyframe = channel?.keyframes.find(
		(candidate) => candidate.id === keyframeId,
	);
	if (!channel || !keyframe) {
		return null;
	}

	const baseValue = getElementBaseValueForProperty({ element, propertyPath });
	if (baseValue === null || typeof baseValue !== "number") {
		return null;
	}

	const sampled = getChannelValueAtTime({
		channel,
		time: keyframe.time,
		fallbackValue: baseValue,
	});
	return typeof sampled === "number" ? sampled : null;
}

function removeKeyframeAndPersist({
	element,
	propertyPath,
	keyframeId,
}: {
	element: TimelineElement;
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
}): TimelineElement {
	const valueBefore = sampleValueBeforeRemoval({
		element,
		propertyPath,
		keyframeId,
	});

	const nextAnimations = removeElementKeyframe({
		animations: element.animations,
		propertyPath,
		keyframeId,
	});

	const isChannelNowEmpty =
		getChannel({ animations: nextAnimations, propertyPath }) === undefined;
	const shouldPersistToBase = isChannelNowEmpty && valueBefore !== null;

	const baseElement = shouldPersistToBase
		? withElementBaseValueForProperty({
				element,
				propertyPath,
				value: valueBefore,
			})
		: element;

	return { ...baseElement, animations: nextAnimations };
}

export class RemoveKeyframeCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly propertyPath: AnimationPropertyPath;
	private readonly keyframeId: string;

	constructor({
		trackId,
		elementId,
		propertyPath,
		keyframeId,
	}: {
		trackId: string;
		elementId: string;
		propertyPath: AnimationPropertyPath;
		keyframeId: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.propertyPath = propertyPath;
		this.keyframeId = keyframeId;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = updateElementInTracks({
			tracks: this.savedState,
			trackId: this.trackId,
			elementId: this.elementId,
			elementPredicate: (element) =>
				supportsAnimationProperty({
					element,
					propertyPath: this.propertyPath,
				}),
			update: (element) =>
				removeKeyframeAndPersist({
					element,
					propertyPath: this.propertyPath,
					keyframeId: this.keyframeId,
				}),
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (!this.savedState) {
			return;
		}

		const editor = EditorCore.getInstance();
		editor.timeline.updateTracks(this.savedState);
	}
}
