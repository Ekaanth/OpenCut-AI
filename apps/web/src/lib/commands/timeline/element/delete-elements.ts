import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { isMainTrack } from "@/lib/timeline";

export class DeleteElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly elements: { trackId: string; elementId: string }[];

	constructor({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}) {
		super();
		this.elements = elements;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState
			.map((track) => {
				const hasElementsToDelete = this.elements.some(
					(elementEntry) => elementEntry.trackId === track.id,
				);

				if (!hasElementsToDelete) {
					return track;
				}

				return {
					...track,
					elements: track.elements.filter(
						(element) =>
							!this.elements.some(
								(elementEntry) =>
									elementEntry.trackId === track.id &&
									elementEntry.elementId === element.id,
							),
					),
				} as typeof track;
			})
			.filter((track) => track.elements.length > 0 || isMainTrack(track));

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
