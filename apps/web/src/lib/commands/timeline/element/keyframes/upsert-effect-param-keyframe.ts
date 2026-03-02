import { EditorCore } from "@/core";
import { Command } from "@/lib/commands/base-command";
import { upsertEffectParamKeyframe } from "@/lib/animation/effect-param-channel";
import { updateElementInTracks } from "@/lib/timeline";
import { isVisualElement } from "@/lib/timeline/element-utils";
import type { TimelineTrack } from "@/types/timeline";

export class UpsertEffectParamKeyframeCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly effectId: string;
	private readonly paramKey: string;
	private readonly time: number;
	private readonly value: number;
	private readonly interpolation: "linear" | "hold" | undefined;
	private readonly keyframeId: string | undefined;

	constructor({
		trackId,
		elementId,
		effectId,
		paramKey,
		time,
		value,
		interpolation,
		keyframeId,
	}: {
		trackId: string;
		elementId: string;
		effectId: string;
		paramKey: string;
		time: number;
		value: number;
		interpolation?: "linear" | "hold";
		keyframeId?: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.effectId = effectId;
		this.paramKey = paramKey;
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
			elementPredicate: isVisualElement,
			update: (element) => {
				const boundedTime = Math.max(0, Math.min(this.time, element.duration));
				const animations = upsertEffectParamKeyframe({
					animations: element.animations,
					effectId: this.effectId,
					paramKey: this.paramKey,
					time: boundedTime,
					value: this.value,
					interpolation: this.interpolation,
					keyframeId: this.keyframeId,
				});
				return { ...element, animations };
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
