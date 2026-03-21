import type { TranscriptionWord, TranscriptionSegment } from "@/types/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeRange {
	start: number;
	end: number;
}

export interface ReorderedSegmentTiming {
	segmentId: number;
	newStart: number;
	newEnd: number;
}

// ---------------------------------------------------------------------------
// mergeTimeRanges – Merge adjacent/overlapping time ranges into continuous cuts
// ---------------------------------------------------------------------------

/**
 * Given an unsorted array of time ranges, merge any that overlap or are
 * adjacent (within a small tolerance) into continuous ranges.
 */
export function mergeTimeRanges(
	ranges: TimeRange[],
	tolerance = 0.01,
): TimeRange[] {
	if (ranges.length === 0) return [];

	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	const merged: TimeRange[] = [{ ...sorted[0] }];

	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const last = merged[merged.length - 1];

		// Overlap or adjacent within tolerance → extend the last range
		if (current.start <= last.end + tolerance) {
			last.end = Math.max(last.end, current.end);
		} else {
			merged.push({ ...current });
		}
	}

	return merged;
}

// ---------------------------------------------------------------------------
// computeCutsFromRemovedWords – Determine time ranges to cut from removed words
// ---------------------------------------------------------------------------

/**
 * Compare the original word list with the remaining words and return the
 * merged time ranges that correspond to the words that were removed.
 *
 * Each removed word contributes its `[start, end]` range. Adjacent removed
 * words will be merged into a single continuous cut.
 */
export function computeCutsFromRemovedWords(
	originalWords: TranscriptionWord[],
	remainingWords: TranscriptionWord[],
): TimeRange[] {
	// Build a set of remaining word identities using start+end as a fingerprint.
	// This is more robust than relying on object identity since the caller may
	// have created new objects for the remaining words.
	const remainingSet = new Set<string>(
		remainingWords.map((w) => `${w.start.toFixed(4)}-${w.end.toFixed(4)}`),
	);

	const removedRanges: TimeRange[] = [];

	for (const word of originalWords) {
		const key = `${word.start.toFixed(4)}-${word.end.toFixed(4)}`;
		if (!remainingSet.has(key)) {
			removedRanges.push({ start: word.start, end: word.end });
		}
	}

	return mergeTimeRanges(removedRanges);
}

// ---------------------------------------------------------------------------
// computeReorderTimeline – Compute new timing when segments are reordered
// ---------------------------------------------------------------------------

/**
 * When a segment is dragged from `fromIndex` to `toIndex`, recompute the
 * start/end times of every segment so that they play in the new order with
 * no gaps.
 *
 * The duration of each segment is preserved – only the offsets change.
 *
 * Returns the new timing for every segment, not just the moved one, because
 * reordering one segment shifts the start times of all subsequent segments.
 */
export function computeReorderTimeline(
	segments: TranscriptionSegment[],
	fromIndex: number,
	toIndex: number,
): ReorderedSegmentTiming[] {
	if (
		fromIndex < 0 ||
		fromIndex >= segments.length ||
		toIndex < 0 ||
		toIndex >= segments.length ||
		fromIndex === toIndex
	) {
		// No-op – return the current arrangement unchanged
		return segments.map((seg) => ({
			segmentId: seg.id,
			newStart: seg.start,
			newEnd: seg.end,
		}));
	}

	// Build the new order (same logic as the store's reorderSegments)
	const reordered = [...segments];
	const [moved] = reordered.splice(fromIndex, 1);
	reordered.splice(toIndex, 0, moved);

	// Compute new timings – pack segments sequentially with no gaps
	const result: ReorderedSegmentTiming[] = [];
	let cursor = reordered.length > 0 ? reordered[0].start : 0;

	// If the first segment's original start was 0, keep it. Otherwise,
	// start from the earliest original start time to maintain the global offset.
	cursor = Math.min(...segments.map((s) => s.start));

	for (const seg of reordered) {
		const duration = seg.end - seg.start;
		result.push({
			segmentId: seg.id,
			newStart: cursor,
			newEnd: cursor + duration,
		});
		cursor += duration;
	}

	return result;
}

// ---------------------------------------------------------------------------
// computeSplitPointsFromSegments – Get unique boundary times for splitting
// ---------------------------------------------------------------------------

/**
 * Given transcription segments, return a sorted list of unique times at which
 * the timeline should be split so that each segment maps to its own clip.
 *
 * We skip the very first start and very last end since those are the media
 * boundaries – splitting there would be a no-op.
 */
export function computeSplitPointsFromSegments(
	segments: TranscriptionSegment[],
): number[] {
	if (segments.length === 0) return [];

	const points = new Set<number>();
	for (const seg of segments) {
		points.add(seg.start);
		points.add(seg.end);
	}

	const sorted = [...points].sort((a, b) => a - b);

	// Drop the very first and very last point (media boundaries)
	if (sorted.length >= 2) {
		return sorted.slice(1, -1);
	}

	return [];
}

// ---------------------------------------------------------------------------
// computeCutsFromDeletedSegments – Build time ranges from deleted segments
// ---------------------------------------------------------------------------

/**
 * Given a list of segments that are being deleted, return the merged time
 * ranges that should be cut from the timeline.
 */
export function computeCutsFromDeletedSegments(
	deletedSegments: TranscriptionSegment[],
): TimeRange[] {
	const ranges: TimeRange[] = deletedSegments.map((seg) => ({
		start: seg.start,
		end: seg.end,
	}));
	return mergeTimeRanges(ranges);
}
