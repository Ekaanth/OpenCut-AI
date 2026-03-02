import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import { isVisualElement, updateElementInTracks } from "@/lib/timeline";
import type { TimelineTrack, VisualElement } from "@/types/timeline";

function removeEffectFromElement({
	element,
	effectId,
}: {
	element: VisualElement;
	effectId: string;
}): VisualElement {
	const currentEffects = element.effects ?? [];
	const filtered = currentEffects.filter((effect) => effect.id !== effectId);
	return { ...element, effects: filtered };
}

export class RemoveClipEffectCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly effectId: string;

	constructor({
		trackId,
		elementId,
		effectId,
	}: {
		trackId: string;
		elementId: string;
		effectId: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.effectId = effectId;
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
			return removeEffectFromElement({
				element: element as VisualElement,
				effectId: this.effectId,
			});
			},
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
