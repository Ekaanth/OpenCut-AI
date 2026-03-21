import { create } from "zustand";
import type {
	TranscriptionSegment,
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

	reset: () => set({ ...initialState, selectedSegmentIds: new Set<number>() }),
}));
