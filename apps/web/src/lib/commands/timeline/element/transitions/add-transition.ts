import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import { isVisualElement, updateElementInTracks } from "@/lib/timeline";
import type {
	TimelineTrack,
	VisualElement,
	TransitionData,
} from "@/types/timeline";
import { getTransition } from "@/lib/transitions";

export class AddTransitionCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly transitionType: string;
	private readonly duration: number;

	constructor({
		trackId,
		elementId,
		transitionType,
		duration,
	}: {
		trackId: string;
		elementId: string;
		transitionType: string;
		duration?: number;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.transitionType = transitionType;
		this.duration =
			duration ?? getTransition({ transitionType }).defaultDuration;
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
				const transition: TransitionData = {
					type: this.transitionType,
					duration: this.duration,
				};
				return { ...element, transitionOut: transition } as VisualElement;
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

export class RemoveTransitionCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;

	constructor({
		trackId,
		elementId,
	}: {
		trackId: string;
		elementId: string;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
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
				const { transitionOut, ...rest } = element as VisualElement & {
					transitionOut?: TransitionData;
				};
				return rest as VisualElement;
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
