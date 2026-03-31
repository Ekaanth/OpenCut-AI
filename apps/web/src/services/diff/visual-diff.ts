import type { TimelineDiff } from "@/types/version";

export type HeatmapSegment = {
	startTime: number;
	endTime: number;
	type: "added" | "removed" | "modified" | "unchanged";
};

/**
 * Compute a timeline heatmap from a diff, showing where changes occur over time.
 * Returns colored segments for visualizing on the timeline.
 */
export function computeTimelineHeatmap(
	diff: TimelineDiff,
	totalDuration: number,
): HeatmapSegment[] {
	if (totalDuration <= 0) return [];

	// Collect all change time ranges
	const changeRanges: { start: number; end: number; type: "added" | "removed" | "modified" }[] = [];

	for (const scene of diff.scenes.modified) {
		for (const elem of scene.elementChanges.added) {
			// We don't have exact times in the summary, mark as full range
			changeRanges.push({ start: 0, end: totalDuration, type: "added" });
		}
		for (const elem of scene.elementChanges.removed) {
			changeRanges.push({ start: 0, end: totalDuration, type: "removed" });
		}
		for (const mod of scene.elementChanges.modified) {
			// Check if there are timing changes to get precise ranges
			for (const change of mod.changes) {
				if (change.path.includes("startTime") && typeof change.newValue === "number") {
					const start = Math.min(change.oldValue as number, change.newValue);
					const end = Math.max(change.oldValue as number, change.newValue) + 1;
					changeRanges.push({ start, end: Math.min(end, totalDuration), type: "modified" });
				} else if (change.path.includes("trimStart") || change.path.includes("trimEnd")) {
					changeRanges.push({ start: 0, end: totalDuration, type: "modified" });
				}
			}
			if (mod.changes.length > 0 && changeRanges.length === 0) {
				changeRanges.push({ start: 0, end: totalDuration, type: "modified" });
			}
		}
	}

	if (changeRanges.length === 0) {
		return [{ startTime: 0, endTime: totalDuration, type: "unchanged" }];
	}

	// Merge overlapping ranges and build segments
	changeRanges.sort((a, b) => a.start - b.start);

	const segments: HeatmapSegment[] = [];
	let lastEnd = 0;

	for (const range of changeRanges) {
		if (range.start > lastEnd) {
			segments.push({ startTime: lastEnd, endTime: range.start, type: "unchanged" });
		}
		segments.push({ startTime: Math.max(range.start, lastEnd), endTime: range.end, type: range.type });
		lastEnd = Math.max(lastEnd, range.end);
	}

	if (lastEnd < totalDuration) {
		segments.push({ startTime: lastEnd, endTime: totalDuration, type: "unchanged" });
	}

	return segments;
}

export const HEATMAP_COLORS: Record<HeatmapSegment["type"], string> = {
	added: "#22c55e",    // green
	removed: "#ef4444",  // red
	modified: "#eab308", // yellow
	unchanged: "#6b7280", // gray
};
