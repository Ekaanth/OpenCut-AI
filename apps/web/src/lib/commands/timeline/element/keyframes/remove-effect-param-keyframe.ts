import { EditorCore } from "@/core";
import { Command } from "@/lib/commands/base-command";
import { removeEffectParamKeyframe } from "@/lib/animation/effect-param-channel";
import { updateElementInTracks } from "@/lib/timeline";
import { isVisualElement } from "@/lib/timeline/element-utils";
import type { TimelineTrack } from "@/types/timeline";

export class RemoveEffectParamKeyframeCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly effectId: string;
	private readonly paramKey: string;
	private readonly keyframeId: string;

	constructor({
		trackId,
		elementId,
		effectId,
		paramKey,
		keyframeId,
	}: {
		trackId: string;
		elementId: string;
		effectId: string;
		paramKey: string;
		keyframeId: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.effectId = effectId;
		this.paramKey = paramKey;
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
				const animations = removeEffectParamKeyframe({
					animations: element.animations,
					effectId: this.effectId,
					paramKey: this.paramKey,
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
