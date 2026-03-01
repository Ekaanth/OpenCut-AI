import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { generateUUID } from "@/utils/id";
import { EditorCore } from "@/core";
import { rippleShiftElements } from "@/lib/timeline";
import { splitAnimationsAtTime } from "@/lib/animation";

export class SplitElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private rightSideElements: { trackId: string; elementId: string }[] = [];
	private previousSelection: { trackId: string; elementId: string }[] = [];
	private readonly elements: { trackId: string; elementId: string }[];
	private readonly splitTime: number;
	private readonly retainSide: "both" | "left" | "right";
	private readonly rippleEnabled: boolean;

	constructor({
		elements,
		splitTime,
		retainSide = "both",
		rippleEnabled = false,
	}: {
		elements: { trackId: string; elementId: string }[];
		splitTime: number;
		retainSide?: "both" | "left" | "right";
		rippleEnabled?: boolean;
	}) {
		super();
		this.elements = elements;
		this.splitTime = splitTime;
		this.retainSide = retainSide;
		this.rippleEnabled = rippleEnabled;
	}

	getRightSideElements(): { trackId: string; elementId: string }[] {
		return this.rightSideElements;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		this.previousSelection = editor.selection.getSelectedElements();
		this.rightSideElements = [];

		const updatedTracks = this.savedState.map((track) => {
			const elementsToSplit = this.elements.filter(
				(target) => target.trackId === track.id,
			);

			if (elementsToSplit.length === 0) {
				return track;
			}

			let leftVisibleDurationForRipple: number | null = null;

			let elements = track.elements.flatMap((element) => {
				const shouldSplit = elementsToSplit.some(
					(target) => target.elementId === element.id,
				);

				if (!shouldSplit) {
					return [element];
				}

				const effectiveStart = element.startTime;
				const effectiveEnd = element.startTime + element.duration;

				if (
					this.splitTime <= effectiveStart ||
					this.splitTime >= effectiveEnd
				) {
					return [element];
				}

				const relativeTime = this.splitTime - element.startTime;
				const leftVisibleDuration = relativeTime;
				const rightVisibleDuration = element.duration - relativeTime;
				const { leftAnimations, rightAnimations } = splitAnimationsAtTime({
					animations: element.animations,
					splitTime: relativeTime,
					shouldIncludeSplitBoundary: true,
				});

				if (this.retainSide === "left") {
					return [
						{
							...element,
							duration: leftVisibleDuration,
							trimEnd: element.trimEnd + rightVisibleDuration,
							name: `${element.name} (left)`,
							animations: leftAnimations,
						},
					];
				}

				if (this.retainSide === "right") {
					if (this.rippleEnabled && elementsToSplit.length === 1) {
						leftVisibleDurationForRipple = leftVisibleDuration;
					}
					const newId = generateUUID();
					this.rightSideElements.push({
						trackId: track.id,
						elementId: newId,
					});
					return [
						{
							...element,
							id: newId,
							startTime: this.splitTime,
							duration: rightVisibleDuration,
							trimStart: element.trimStart + leftVisibleDuration,
							name: `${element.name} (right)`,
							animations: rightAnimations,
						},
					];
				}

				// "both" - split into two pieces
				const secondElementId = generateUUID();
				this.rightSideElements.push({
					trackId: track.id,
					elementId: secondElementId,
				});

				return [
					{
						...element,
						duration: leftVisibleDuration,
						trimEnd: element.trimEnd + rightVisibleDuration,
						name: `${element.name} (left)`,
						animations: leftAnimations,
					},
					{
						...element,
						id: secondElementId,
						startTime: this.splitTime,
						duration: rightVisibleDuration,
						trimStart: element.trimStart + leftVisibleDuration,
						name: `${element.name} (right)`,
						animations: rightAnimations,
					},
				];
			});

			if (this.rippleEnabled && leftVisibleDurationForRipple !== null) {
				elements = rippleShiftElements({
					elements,
					afterTime: this.splitTime,
					shiftAmount: leftVisibleDurationForRipple,
				});
			}

			return { ...track, elements } as typeof track;
		});

		editor.timeline.updateTracks(updatedTracks);

		if (this.rightSideElements.length > 0) {
			editor.selection.setSelectedElements({
				elements: this.rightSideElements,
			});
		}
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
			editor.selection.setSelectedElements({
				elements: this.previousSelection,
			});
		}
	}
}
