import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { clampAnimationsToDuration } from "@/lib/animation";

export class UpdateElementTrimCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private readonly elementId: string;
	private readonly trimStart: number;
	private readonly trimEnd: number;
	private readonly startTime: number | undefined;
	private readonly duration: number | undefined;

	constructor({
		elementId,
		trimStart,
		trimEnd,
		startTime,
		duration,
	}: {
		elementId: string;
		trimStart: number;
		trimEnd: number;
		startTime?: number;
		duration?: number;
	}) {
		super();
		this.elementId = elementId;
		this.trimStart = trimStart;
		this.trimEnd = trimEnd;
		this.startTime = startTime;
		this.duration = duration;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((track) => {
			const newElements = track.elements.map((element) => {
				if (element.id !== this.elementId) {
					return element;
				}

				const nextDuration = this.duration ?? element.duration;
				return {
					...element,
					trimStart: this.trimStart,
					trimEnd: this.trimEnd,
					startTime: this.startTime ?? element.startTime,
					duration: nextDuration,
					animations: clampAnimationsToDuration({
						animations: element.animations,
						duration: nextDuration,
					}),
				};
			});
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
