"use client";

import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import {
	captureTranscriptSnapshot,
	hasTranscriptChanged,
	TranscriptSnapshotCommand,
} from "@/lib/commands/transcript";
import { applyTimeRangeCuts, compactTimeline } from "@/lib/timeline-edits";
import { mergeTimeRanges, type TimeRange } from "@/lib/text-timeline-sync";
import { toast } from "sonner";

export type SpeakerOp = "remove" | "tighten" | "isolate";

export interface SpeakerStats {
	id: string;
	label: string;
	segmentCount: number;
	totalSeconds: number;
}

/**
 * Edit-by-speaker: scope transcript + timeline operations to a single speaker.
 *
 * Speakers come from diarization (`applySpeakerDiarization` on the transcript
 * store), which stamps `segment.speaker`. This hook reuses Smart Cut's exact
 * cut/compact helpers (from `lib/timeline-edits.ts`) so behavior is consistent
 * and every op is wrapped in one undoable transaction.
 */
export function useEditBySpeaker() {
	const editor = useEditor();

	const getSpeakers = useCallback((): SpeakerStats[] => {
		const { segments, speakerNames } = useTranscriptStore.getState();
		const map = new Map<string, SpeakerStats>();
		for (const seg of segments) {
			if (!seg.speaker) continue;
			const existing = map.get(seg.speaker);
			const label = speakerNames[seg.speaker] ?? prettySpeakerId(seg.speaker);
			if (existing) {
				existing.segmentCount += 1;
				existing.totalSeconds += seg.end - seg.start;
			} else {
				map.set(seg.speaker, {
					id: seg.speaker,
					label,
					segmentCount: 1,
					totalSeconds: seg.end - seg.start,
				});
			}
		}
		// Sort by first-appearance order (SPEAKER_00, SPEAKER_01, …).
		return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
	}, []);

	const rangesForSpeaker = useCallback((speakerId: string): TimeRange[] => {
		const { segments } = useTranscriptStore.getState();
		const ranges: TimeRange[] = segments
			.filter((s) => s.speaker === speakerId)
			.map((s) => ({ start: s.start, end: s.end }));
		return mergeTimeRanges(ranges);
	}, []);

	const idsForSpeaker = useCallback((speakerId: string): number[] => {
		const { segments } = useTranscriptStore.getState();
		return segments.filter((s) => s.speaker === speakerId).map((s) => s.id);
	}, []);

	/** Remove every segment spoken by `speakerId` + cut the timeline ranges. */
	const removeSpeaker = useCallback(
		async (speakerId: string) => {
			const ranges = rangesForSpeaker(speakerId);
			const ids = idsForSpeaker(speakerId);
			if (ranges.length === 0) {
				toast.error("No segments found for that speaker.");
				return;
			}
			const label =
				useTranscriptStore.getState().speakerNames[speakerId] ??
				prettySpeakerId(speakerId);

			const supportsTx = typeof editor.command.beginTransaction === "function";
			const before = captureTranscriptSnapshot();
			if (supportsTx) editor.command.beginTransaction();

			applyTimeRangeCuts(editor, ranges);
			if (ids.length > 0) {
				useTranscriptStore.getState().deleteSegments(ids);
			}

			if (supportsTx) {
				const after = captureTranscriptSnapshot();
				if (hasTranscriptChanged(before, after)) {
					editor.command.push({
						command: new TranscriptSnapshotCommand(before, after),
					});
				}
				editor.command.commitTransaction();
			}
			toast.success(
				`Removed ${ranges.length} sections by ${label} (${ranges.reduce(
					(sum, r) => sum + (r.end - r.start),
					0,
				).toFixed(1)}s).`,
			);
		},
		[editor, rangesForSpeaker, idsForSpeaker],
	);

	/** Ripple-close gaps *between* this speaker's consecutive segments
	 *  that are shorter than `maxGap`. Only this speaker's own dead air. */
	const tightenSpeakerGaps = useCallback(
		async (speakerId: string, maxGap = 1.5) => {
			const { segments } = useTranscriptStore.getState();
			const mine = segments
				.filter((s) => s.speaker === speakerId)
				.sort((a, b) => a.start - b.start);
			if (mine.length < 2) {
				toast.error("Not enough segments from that speaker to tighten.");
				return;
			}
			const label =
				useTranscriptStore.getState().speakerNames[speakerId] ??
				prettySpeakerId(speakerId);

			// Collect the silence ranges sitting between consecutive same-speaker
			// segments that we want to excise.
			const cuts: TimeRange[] = [];
			for (let i = 1; i < mine.length; i++) {
				const gapStart = mine[i - 1].end;
				const gapEnd = mine[i].start;
				const gap = gapEnd - gapStart;
				if (gap > 0.05 && gap <= maxGap) {
					cuts.push({ start: gapStart, end: gapEnd });
				}
			}
			if (cuts.length === 0) {
				toast(`No gaps ≤ ${maxGap}s between ${label}'s segments.`);
				return;
			}

			const supportsTx = typeof editor.command.beginTransaction === "function";
			if (supportsTx) editor.command.beginTransaction();
			applyTimeRangeCuts(editor, cuts);
			compactTimeline(editor);
			if (supportsTx) editor.command.commitTransaction();

			toast.success(`Tightened ${cuts.length} gaps by ${label}.`);
		},
		[editor],
	);

	/** Mute/hide every track whose clips are NOT this speaker, so only
	 *  `speakerId` is audible/visible. Non-destructive (toggleable). */
	const isolateSpeaker = useCallback(
		(speakerId: string) => {
			const ranges = new Set<number>();
			for (const r of rangesForSpeaker(speakerId)) {
				// mark a coarse bucket per second so we can test membership cheaply
				for (let t = Math.floor(r.start); t <= Math.ceil(r.end); t++) {
					ranges.add(t);
				}
			}
			const tracks = editor.timeline.getTracks();
			let muted = 0;
			for (const track of tracks) {
				if (track.type !== "video" && track.type !== "audio") continue;
				// Heuristic: if the track has any element overlapping the speaker's
				// ranges, treat it as "theirs" and leave it; otherwise mute.
				const hasTheirs = track.elements.some((el) => {
					const start = Math.floor(el.startTime);
					const end = Math.ceil(el.startTime + el.duration);
					for (let t = start; t <= end; t++) {
						if (ranges.has(t)) return true;
					}
					return false;
				});
				if (!hasTheirs) {
					try {
						editor.timeline.updateTrack({
							trackId: track.id,
							updates: { muted: true },
						});
						muted += 1;
					} catch {
						// updateTrack may not accept muted for all track types; ignore.
					}
				}
			}
			toast.success(
				muted > 0
					? `Isolated speaker — muted ${muted} unrelated track${muted === 1 ? "" : "s"}.`
					: "Nothing to mute — all tracks overlap this speaker.",
			);
		},
		[editor, rangesForSpeaker],
	);

	return {
		getSpeakers,
		removeSpeaker,
		tightenSpeakerGaps,
		isolateSpeaker,
	};
}

function prettySpeakerId(id: string): string {
	// "SPEAKER_00" → "Speaker 1"
	const match = /(\d+)/.exec(id);
	if (!match) return id;
	return `Speaker ${Number.parseInt(match[1], 10) + 1}`;
}
