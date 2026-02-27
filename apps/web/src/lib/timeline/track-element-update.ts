import type { TimelineElement, TimelineTrack } from "@/types/timeline";

export function updateElementInTracks({
	tracks,
	trackId,
	elementId,
	update,
	elementPredicate,
}: {
	tracks: TimelineTrack[];
	trackId: string;
	elementId: string;
	update: (element: TimelineElement) => TimelineElement;
	elementPredicate?: (element: TimelineElement) => boolean;
}): TimelineTrack[] {
	return tracks.map((track) => {
		if (track.id !== trackId) {
			return track;
		}

		const nextElements = track.elements.map((element) => {
			if (element.id !== elementId) {
				return element;
			}
			if (elementPredicate && !elementPredicate(element)) {
				return element;
			}
			return update(element);
		});

		return { ...track, elements: nextElements } as TimelineTrack;
	});
}
