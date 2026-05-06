import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import { generateUUID } from "@/utils/id";
import { DEFAULT_TRANSFORM } from "@/constants/timeline-constants";

export class NestClipsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private compoundElementId: string;

	constructor(
		private elements: { trackId: string; elementId: string }[],
	) {
		super();
		this.compoundElementId = generateUUID();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const results = editor.timeline.getElementsWithTracks({ elements: this.elements });
		if (results.length < 2) return;

		const firstElement = results[0].element;
		const minStartTime = Math.min(...results.map((r) => r.element.startTime));
		const maxEndTime = Math.max(...results.map((r) => r.element.startTime + r.element.duration));
		const compoundDuration = maxEndTime - minStartTime;

		const innerTracks = this.extractInnerTracks(results, minStartTime);

		const compoundElement: TimelineElement = {
			id: this.compoundElementId,
			type: "video" as const,
			mediaId: `compound-${this.compoundElementId}`,
			name: "Compound Clip",
			startTime: minStartTime,
			duration: compoundDuration,
			trimStart: 0,
			trimEnd: 0,
			transform: DEFAULT_TRANSFORM,
			opacity: 1,
		} as TimelineElement;

		const tracks = editor.timeline.getTracks();
		const elementIds = new Set(this.elements.map((e) => e.elementId));

		const updatedTracks = tracks.map((track) => {
			const filteredElements = track.elements.filter((e) => !elementIds.has(e.id));
			if (filteredElements.length !== track.elements.length) {
				return {
					...track,
					elements: [...filteredElements, compoundElement],
				} as TimelineTrack;
			}
			return track;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}

	getCompoundElementId(): string {
		return this.compoundElementId;
	}

	private extractInnerTracks(
		results: Array<{ track: TimelineTrack; element: TimelineElement }>,
		offset: number,
	): TimelineTrack[] {
		const trackMap = new Map<string, TimelineElement[]>();
		for (const { track, element } of results) {
			const existing = trackMap.get(track.id) ?? [];
			existing.push({ ...element, startTime: element.startTime - offset });
			trackMap.set(track.id, existing);
		}

		return Array.from(trackMap.entries()).map(([trackId, elements]) => ({
			id: trackId,
			name: "Inner Track",
			type: "video" as const,
			elements,
			isMain: false,
			muted: false,
			hidden: false,
		} as TimelineTrack));
	}
}
