import { create } from "zustand";
import type { EngagementScoreResult } from "@/lib/ai-client";

interface EngagementState {
	currentScore: EngagementScoreResult | null;
	isAnalyzing: boolean;
	lastAnalyzedAt: number | null;
	error: string | null;

	setScore: (score: EngagementScoreResult) => void;
	setAnalyzing: (v: boolean) => void;
	setError: (error: string | null) => void;
	clear: () => void;
}

export const useEngagementStore = create<EngagementState>()((set) => ({
	currentScore: null,
	isAnalyzing: false,
	lastAnalyzedAt: null,
	error: null,

	setScore: (score) =>
		set({ currentScore: score, isAnalyzing: false, lastAnalyzedAt: Date.now(), error: null }),

	setAnalyzing: (v) => set({ isAnalyzing: v, error: null }),

	setError: (error) => set({ error, isAnalyzing: false }),

	clear: () =>
		set({ currentScore: null, isAnalyzing: false, lastAnalyzedAt: null, error: null }),
}));
