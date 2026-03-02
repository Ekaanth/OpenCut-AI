import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import { isVisualElement, updateElementInTracks } from "@/lib/timeline";
import type { TimelineTrack, VisualElement } from "@/types/timeline";
import { buildDefaultEffectInstance } from "@/lib/effects";

function addEffectToElement({
	element,
	effectType,
}: {
	element: VisualElement;
	effectType: string;
}): VisualElement {
	const instance = buildDefaultEffectInstance({ effectType });
	const currentEffects = element.effects ?? [];
	return { ...element, effects: [...currentEffects, instance] };
}

export class AddClipEffectCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private effectId: string | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly effectType: string;

	constructor({
		trackId,
		elementId,
		effectType,
	}: {
		trackId: string;
		elementId: string;
		effectType: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.effectType = effectType;
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
			const updated = addEffectToElement({
				element: element as VisualElement,
				effectType: this.effectType,
			});
				const effects = updated.effects ?? [];
				this.effectId = effects[effects.length - 1]?.id ?? null;
				return updated;
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

	getEffectId(): string | null {
		return this.effectId;
	}
}
