/**
 * Shared timeline edit helpers.
 *
 * Extracted from `use-smart-cut.ts` so that Smart Cut and Edit-by-Speaker
 * (and any future transcript-driven editor) share the exact same cut/compact
 * logic. No behavior change to Smart Cut — it imports these back.
 *
 * These functions mutate the timeline through the editor's own command-pushing
 * methods (`splitElements`, `deleteElements`, `updateElements`), so every
 * change they make is individually undoable. Callers are expected to wrap a
 * batch in `editor.command.beginTransaction()` / `commitTransaction()`.
 */

import type { TimelineElement, TimelineTrack } from "@/types/timeline";
import { getElementsAtTime } from "@/lib/timeline";
import type { TimeRange } from "@/lib/text-timeline-sync";

/**
 * Minimal editor surface these helpers depend on. Structurally compatible
 * with the real `EditorCore` singleton and the `useEditor()` return, so
 * either can be passed without a wrapper.
 */
export interface TimelineEditor {
	timeline: {
		getTracks(): TimelineTrack[];
		splitElements(args: {
			elements: Array<{ trackId: string; elementId: string }>;
			splitTime: number;
			retainSide?: "both" | "left" | "right";
			rippleEnabled?: boolean;
		}): unknown;
		deleteElements(args: {
			elements: Array<{ trackId: string; elementId: string }>;
			rippleEnabled?: boolean;
		}): unknown;
		updateElements(args: {
			updates: Array<{
				trackId: string;
				elementId: string;
				updates: Partial<TimelineElement>;
			}>;
		}): unknown;
	};
}

/**
 * Remove every element whose time range falls fully inside one of `cuts`,
 * splitting at each cut boundary first so non-aligned clips are cleanly
 * excised. Pass `rippleEnabled` to also close the gaps left behind.
 *
 * Cuts should be sorted latest-first to avoid index drift as elements are
 * deleted (this is how Smart Cut calls it). `mergeTimeRanges` from
 * `@/lib/text-timeline-sync` produces correctly-merged ranges.
 */
export function applyTimeRangeCuts(
	editor: TimelineEditor,
	cuts: TimeRange[],
): void {
	if (cuts.length === 0) return;

	const sortedCuts = [...cuts].sort((a, b) => b.start - a.start);

	for (const cut of sortedCuts) {
		const elementsAtStart = getElementsAtTime({
			tracks: editor.timeline.getTracks(),
			time: cut.start,
		});
		if (elementsAtStart.length > 0) {
			editor.timeline.splitElements({
				elements: elementsAtStart,
				splitTime: cut.start,
			});
		}

		const elementsAtEnd = getElementsAtTime({
			tracks: editor.timeline.getTracks(),
			time: cut.end,
		});
		if (elementsAtEnd.length > 0) {
			editor.timeline.splitElements({
				elements: elementsAtEnd,
				splitTime: cut.end,
			});
		}

		const currentTracks = editor.timeline.getTracks();
		const elementsToDelete: { trackId: string; elementId: string }[] = [];

		for (const track of currentTracks) {
			for (const element of track.elements) {
				if (
					element.startTime >= cut.start - 0.01 &&
					element.startTime + element.duration <= cut.end + 0.01
				) {
					elementsToDelete.push({
						trackId: track.id,
						elementId: element.id,
					});
				}
			}
		}

		if (elementsToDelete.length > 0) {
			editor.timeline.deleteElements({
				elements: elementsToDelete,
				rippleEnabled: true,
			});
		}
	}

	compactTimeline(editor);
}

/**
 * Ripple-close gaps on every track by walking elements in `startTime` order
 * and butting each one against the previous. Used after deletions to remove
 * the silence they leave behind.
 */
export function compactTimeline(editor: TimelineEditor): void {
	const tracks = editor.timeline.getTracks();
	const updates: Array<{
		trackId: string;
		elementId: string;
		updates: Partial<TimelineElement>;
	}> = [];

	for (const track of tracks) {
		const sorted = [...track.elements].sort((a, b) => a.startTime - b.startTime);
		let cursor = sorted[0]?.startTime ?? 0;
		if (sorted.length > 0 && cursor > 0.01) {
			cursor = 0;
		}

		for (const element of sorted) {
			if (Math.abs(element.startTime - cursor) > 0.01) {
				updates.push({
					trackId: track.id,
					elementId: element.id,
					updates: { startTime: cursor },
				});
			}
			cursor += element.duration;
		}
	}

	if (updates.length > 0) {
		editor.timeline.updateElements({ updates });
	}
}

/**
 * Shift every element on the given trackIds by `offsetSeconds`. Used by
 * multicam sync to align angles. Does not compact — pure offset.
 */
export function shiftTracksByOffset(
	editor: TimelineEditor,
	trackIds: string[],
	offsetSeconds: number,
): void {
	if (trackIds.length === 0 || offsetSeconds === 0) return;
	const tracks = editor.timeline.getTracks();
	const wanted = new Set(trackIds);
	const updates: Array<{
		trackId: string;
		elementId: string;
		updates: Partial<TimelineElement>;
	}> = [];
	for (const track of tracks) {
		if (!wanted.has(track.id)) continue;
		for (const element of track.elements) {
			updates.push({
				trackId: track.id,
				elementId: element.id,
				updates: { startTime: Math.max(0, element.startTime + offsetSeconds) },
			});
		}
	}
	if (updates.length > 0) {
		editor.timeline.updateElements({ updates });
	}
}
