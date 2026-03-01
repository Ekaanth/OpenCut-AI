import { Command } from "@/lib/commands/base-command";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { updateElementInTracks } from "@/lib/timeline";

export class UpdateElementCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly updates: Partial<TimelineElement>;

	constructor({
		trackId,
		elementId,
		updates,
	}: {
		trackId: string;
		elementId: string;
		updates: Partial<TimelineElement>;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.updates = updates;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = updateElementInTracks({
			tracks: this.savedState,
			trackId: this.trackId,
			elementId: this.elementId,
			update: (element) => ({ ...element, ...this.updates }) as TimelineElement,
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
