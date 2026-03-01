import { EditorCore } from "@/core";
import { Command } from "@/lib/commands/base-command";
import { supportsAnimationProperty, upsertElementKeyframe } from "@/lib/animation";
import { updateElementInTracks } from "@/lib/timeline";
import type { TimelineTrack } from "@/types/timeline";
import type {
	AnimationInterpolation,
	AnimationPropertyPath,
	AnimationValue,
} from "@/types/animation";

export class UpsertKeyframeCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly propertyPath: AnimationPropertyPath;
	private readonly time: number;
	private readonly value: AnimationValue;
	private readonly interpolation: AnimationInterpolation | undefined;
	private readonly keyframeId: string | undefined;

	constructor({
		trackId,
		elementId,
		propertyPath,
		time,
		value,
		interpolation,
		keyframeId,
	}: {
		trackId: string;
		elementId: string;
		propertyPath: AnimationPropertyPath;
		time: number;
		value: AnimationValue;
		interpolation?: AnimationInterpolation;
		keyframeId?: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.propertyPath = propertyPath;
		this.time = time;
		this.value = value;
		this.interpolation = interpolation;
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
			update: (element) => {
				const boundedTime = Math.max(0, Math.min(this.time, element.duration));
				return {
					...element,
					animations: upsertElementKeyframe({
						animations: element.animations,
						propertyPath: this.propertyPath,
						time: boundedTime,
						value: this.value,
						interpolation: this.interpolation,
						keyframeId: this.keyframeId,
					}),
				};
			},
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
