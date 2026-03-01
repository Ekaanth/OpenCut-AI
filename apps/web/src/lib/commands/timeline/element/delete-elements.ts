import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { isMainTrack, rippleShiftElements } from "@/lib/timeline";

export class DeleteElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly elements: { trackId: string; elementId: string }[];
	private readonly rippleEnabled: boolean;

	constructor({
		elements,
		rippleEnabled = false,
	}: {
		elements: { trackId: string; elementId: string }[];
		rippleEnabled?: boolean;
	}) {
		super();
		this.elements = elements;
		this.rippleEnabled = rippleEnabled;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState
			.map((track) => {
				const elementsToDeleteOnTrack = this.elements.filter(
					(target) => target.trackId === track.id,
				);
				const hasElementsToDelete = elementsToDeleteOnTrack.length > 0;

				if (!hasElementsToDelete) {
					return track;
				}

				const deletedElementInfos = elementsToDeleteOnTrack
					.map((target) =>
						track.elements.find((element) => element.id === target.elementId),
					)
					.filter((element): element is NonNullable<typeof element> => element !== undefined)
					.map((element) => ({ startTime: element.startTime, duration: element.duration }));

				let elements = track.elements.filter(
					(element) =>
						!this.elements.some(
							(target) =>
								target.trackId === track.id && target.elementId === element.id,
						),
				);

				if (this.rippleEnabled && deletedElementInfos.length > 0) {
					const sortedByStartDesc = [...deletedElementInfos].sort(
						(a, b) => b.startTime - a.startTime,
					);
					for (const { startTime, duration } of sortedByStartDesc) {
						elements = rippleShiftElements({
							elements,
							afterTime: startTime,
							shiftAmount: duration,
						});
					}
				}

				return { ...track, elements } as typeof track;
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
