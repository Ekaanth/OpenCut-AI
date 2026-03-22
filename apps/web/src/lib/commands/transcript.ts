import { Command } from "./base-command";
import { useTranscriptStore } from "@/stores/transcript-store";
import type {
	TranscriptionSegment,
	EmotionSegment,
	FillerWord,
	SilenceRegion,
	Chapter,
} from "@/types/ai";
import type { TranslatedTranscript } from "@/stores/transcript-store";

/**
 * Serialisable snapshot of the transcript store's data state.
 * UI-only fields (isTranscribing, progress, selectedSegmentIds) are excluded
 * because they shouldn't be affected by undo/redo.
 */
export interface TranscriptSnapshot {
	segments: TranscriptionSegment[];
	fillers: FillerWord[];
	silences: SilenceRegion[];
	chapters: Chapter[];
	translations: TranslatedTranscript[];
	speakerNames: Record<string, string>;
	speakerPositions: Record<string, "left" | "right" | "center">;
	emotions: EmotionSegment[];
}

export function captureTranscriptSnapshot(): TranscriptSnapshot {
	const s = useTranscriptStore.getState();
	return {
		segments: s.segments,
		fillers: s.fillers,
		silences: s.silences,
		chapters: s.chapters,
		translations: s.translations,
		speakerNames: { ...s.speakerNames },
		speakerPositions: { ...s.speakerPositions },
		emotions: s.emotions,
	};
}

function restoreTranscriptSnapshot(snap: TranscriptSnapshot): void {
	const store = useTranscriptStore.getState();
	store.setSegments(snap.segments);
	store.setFillers(snap.fillers);
	store.setSilences(snap.silences);
	store.setChapters(snap.chapters);
	store.setSpeakerNames(snap.speakerNames);
	store.setEmotions(snap.emotions);
	// Restore translations one by one (store only exposes add/remove)
	const current = useTranscriptStore.getState().translations;
	for (const t of current) {
		store.removeTranslation(t.languageCode);
	}
	for (const t of snap.translations) {
		store.addTranslation(t);
	}
	// Restore speaker positions
	for (const [id, pos] of Object.entries(snap.speakerPositions)) {
		store.setSpeakerPosition(id, pos);
	}
}

/**
 * Command that restores a transcript snapshot on undo/redo.
 * This is a "passive" command — execute() applies the afterState,
 * undo() restores the beforeState.
 */
export class TranscriptSnapshotCommand extends Command {
	private beforeState: TranscriptSnapshot;
	private afterState: TranscriptSnapshot;

	constructor(before: TranscriptSnapshot, after: TranscriptSnapshot) {
		super();
		this.beforeState = before;
		this.afterState = after;
	}

	execute(): void {
		restoreTranscriptSnapshot(this.afterState);
	}

	undo(): void {
		restoreTranscriptSnapshot(this.beforeState);
	}
}

/**
 * Check whether the transcript data actually changed between two snapshots.
 */
export function hasTranscriptChanged(
	a: TranscriptSnapshot,
	b: TranscriptSnapshot,
): boolean {
	return (
		a.segments !== b.segments ||
		a.fillers !== b.fillers ||
		a.silences !== b.silences ||
		a.chapters !== b.chapters ||
		a.translations !== b.translations ||
		a.emotions !== b.emotions ||
		JSON.stringify(a.speakerNames) !== JSON.stringify(b.speakerNames) ||
		JSON.stringify(a.speakerPositions) !== JSON.stringify(b.speakerPositions)
	);
}
