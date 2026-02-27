import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { clampAnimationsToDuration } from "@/lib/animation";

export class UpdateElementDurationCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly duration: number;

	constructor({
		trackId,
		elementId,
		duration,
	}: {
		trackId: string;
		elementId: string;
		duration: number;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.duration = duration;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((track) => {
			if (track.id !== this.trackId) return track;
			const newElements = track.elements.map((element) =>
				element.id === this.elementId
					? {
							...element,
							duration: this.duration,
							animations: clampAnimationsToDuration({
								animations: element.animations,
								duration: this.duration,
							}),
						}
					: element,
			);
			return { ...track, elements: newElements } as typeof track;
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
