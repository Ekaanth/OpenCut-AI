import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import { isVisualElement, updateElementInTracks } from "@/lib/timeline";
import type { TimelineTrack, VisualElement } from "@/types/timeline";

function reorderEffectsOnElement({
	element,
	fromIndex,
	toIndex,
}: {
	element: VisualElement;
	fromIndex: number;
	toIndex: number;
}): VisualElement {
	const effects = [...(element.effects ?? [])];
	const [moved] = effects.splice(fromIndex, 1);
	effects.splice(toIndex, 0, moved);
	return { ...element, effects };
}

export class ReorderClipEffectsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly fromIndex: number;
	private readonly toIndex: number;

	constructor({
		trackId,
		elementId,
		fromIndex,
		toIndex,
	}: {
		trackId: string;
		elementId: string;
		fromIndex: number;
		toIndex: number;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.fromIndex = fromIndex;
		this.toIndex = toIndex;
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
			return reorderEffectsOnElement({
				element: element as VisualElement,
				fromIndex: this.fromIndex,
				toIndex: this.toIndex,
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
