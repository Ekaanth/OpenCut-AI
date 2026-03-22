import { create } from "zustand";
import type {
	TranscriptionSegment,
	EmotionSegment,
	FillerWord,
	SilenceRegion,
	Chapter,
} from "@/types/ai";

export interface TranslatedTranscript {
	languageCode: string;
	languageName: string;
	segments: TranscriptionSegment[];
}

interface TranscriptState {
	segments: TranscriptionSegment[];
	isTranscribing: boolean;
	progress: number;
	language: string;
	duration: number;
	selectedSegmentIds: Set<number>;
	fillers: FillerWord[];
	silences: SilenceRegion[];
	chapters: Chapter[];
	translations: TranslatedTranscript[];
	/** Map from raw speaker ID (e.g. "SPEAKER_A") to user-defined name */
	speakerNames: Record<string, string>;
	/** Map from speaker ID to visual position ("left" | "right" | "center") */
	speakerPositions: Record<string, "left" | "right" | "center">;
	/** Emotion annotations from speechbrain / energy analysis */
	emotions: EmotionSegment[];

	setSegments: (segments: TranscriptionSegment[]) => void;
	addSegment: (segment: TranscriptionSegment) => void;
	updateSegment: (
		id: number,
		updates: Partial<TranscriptionSegment>,
	) => void;
	setTranscribing: (isTranscribing: boolean) => void;
	setProgress: (progress: number) => void;
	setLanguage: (language: string) => void;
	deleteSegments: (ids: number[]) => void;
	reorderSegments: (fromIndex: number, toIndex: number) => void;
	selectSegment: (id: number) => void;
	deselectSegment: (id: number) => void;
	clearSelection: () => void;
	getTimeRangeForSegments: (
		ids: number[],
	) => { start: number; end: number } | null;
	setFillers: (fillers: FillerWord[]) => void;
	setSilences: (silences: SilenceRegion[]) => void;
	setChapters: (chapters: Chapter[]) => void;
	addTranslation: (translation: TranslatedTranscript) => void;
	removeTranslation: (languageCode: string) => void;
	setSpeakerName: (speakerId: string, name: string) => void;
	setSpeakerNames: (names: Record<string, string>) => void;
	setSpeakerPosition: (speakerId: string, position: "left" | "right" | "center") => void;
	setEmotions: (emotions: EmotionSegment[]) => void;
	/** Assign speaker IDs to segments by matching diarization time ranges */
	applySpeakerDiarization: (
		speakerSegments: { speaker: string; start: number; end: number }[],
	) => void;
	reset: () => void;
}

const initialState = {
	segments: [] as TranscriptionSegment[],
	isTranscribing: false,
	progress: 0,
	language: "auto",
	duration: 0,
	selectedSegmentIds: new Set<number>(),
	fillers: [] as FillerWord[],
	silences: [] as SilenceRegion[],
	chapters: [] as Chapter[],
	translations: [] as TranslatedTranscript[],
	speakerNames: {} as Record<string, string>,
	speakerPositions: {} as Record<string, "left" | "right" | "center">,
	emotions: [] as EmotionSegment[],
};

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
	...initialState,

	setSegments: (segments) => set({ segments }),

	addSegment: (segment) =>
		set((state) => ({ segments: [...state.segments, segment] })),

	updateSegment: (id, updates) =>
		set((state) => ({
			segments: state.segments.map((seg) =>
				seg.id === id ? { ...seg, ...updates } : seg,
			),
		})),

	setTranscribing: (isTranscribing) => set({ isTranscribing }),

	setProgress: (progress) => set({ progress }),

	setLanguage: (language) => set({ language }),

	deleteSegments: (ids) =>
		set((state) => {
			const idSet = new Set(ids);
			return {
				segments: state.segments.filter((seg) => !idSet.has(seg.id)),
				selectedSegmentIds: new Set(
					[...state.selectedSegmentIds].filter(
						(selectedId) => !idSet.has(selectedId),
					),
				),
			};
		}),

	reorderSegments: (fromIndex, toIndex) =>
		set((state) => {
			const newSegments = [...state.segments];
			const [moved] = newSegments.splice(fromIndex, 1);
			newSegments.splice(toIndex, 0, moved);
			return { segments: newSegments };
		}),

	selectSegment: (id) =>
		set((state) => {
			const newSelection = new Set(state.selectedSegmentIds);
			newSelection.add(id);
			return { selectedSegmentIds: newSelection };
		}),

	deselectSegment: (id) =>
		set((state) => {
			const newSelection = new Set(state.selectedSegmentIds);
			newSelection.delete(id);
			return { selectedSegmentIds: newSelection };
		}),

	clearSelection: () => set({ selectedSegmentIds: new Set<number>() }),

	getTimeRangeForSegments: (ids) => {
		const { segments } = get();
		const idSet = new Set(ids);
		const matching = segments.filter((seg) => idSet.has(seg.id));

		if (matching.length === 0) return null;

		const start = Math.min(...matching.map((seg) => seg.start));
		const end = Math.max(...matching.map((seg) => seg.end));

		return { start, end };
	},

	setFillers: (fillers) => set({ fillers }),

	setSilences: (silences) => set({ silences }),

	setChapters: (chapters) => set({ chapters }),

	addTranslation: (translation) =>
		set((state) => ({
			translations: [
				...state.translations.filter(
					(t) => t.languageCode !== translation.languageCode,
				),
				translation,
			],
		})),

	removeTranslation: (languageCode) =>
		set((state) => ({
			translations: state.translations.filter(
				(t) => t.languageCode !== languageCode,
			),
		})),

	setSpeakerName: (speakerId, name) =>
		set((state) => ({
			speakerNames: { ...state.speakerNames, [speakerId]: name },
		})),

	setSpeakerNames: (names) =>
		set({ speakerNames: names }),

	setSpeakerPosition: (speakerId, position) =>
		set((state) => ({
			speakerPositions: { ...state.speakerPositions, [speakerId]: position },
		})),

	setEmotions: (emotions) => set({ emotions }),

	applySpeakerDiarization: (speakerSegments) =>
		set((state) => {
			// For each transcript segment, find the speaker segment with the most overlap
			const updatedSegments = state.segments.map((seg) => {
				let bestSpeaker: string | undefined;
				let bestOverlap = 0;

				for (const spk of speakerSegments) {
					const overlapStart = Math.max(seg.start, spk.start);
					const overlapEnd = Math.min(seg.end, spk.end);
					const overlap = Math.max(0, overlapEnd - overlapStart);

					if (overlap > bestOverlap) {
						bestOverlap = overlap;
						bestSpeaker = spk.speaker;
					}
				}

				return { ...seg, speaker: bestSpeaker };
			});

			// Build default speaker name and position maps
			const speakerIds = new Set(speakerSegments.map((s) => s.speaker));
			const defaultNames: Record<string, string> = {};
			const defaultPositions: Record<string, "left" | "right" | "center"> = {};
			const positionOrder: ("left" | "right" | "center")[] = ["left", "right", "center"];
			const sortedIds = [...speakerIds].sort();
			for (let i = 0; i < sortedIds.length; i++) {
				const id = sortedIds[i];
				defaultNames[id] = state.speakerNames[id] || `Speaker ${String.fromCharCode(65 + i)}`;
				defaultPositions[id] = state.speakerPositions[id] || positionOrder[Math.min(i, 2)];
			}

			return {
				segments: updatedSegments,
				speakerNames: defaultNames,
				speakerPositions: defaultPositions,
			};
		}),

	reset: () => set({ ...initialState, selectedSegmentIds: new Set<number>() }),
}));
