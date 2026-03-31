/**
 * UI state for version control (Git for Video).
 * Core logic lives in VersionManager; this store exposes state to React.
 */

import { create } from "zustand";
import type { Commit, VersionStatus } from "@/types/version";

interface VersionStore {
	// State
	currentBranch: string;
	commits: Commit[];
	isDirty: boolean;
	lastCommitId: string | null;
	isCommitting: boolean;
	isRestoring: boolean;
	isLoading: boolean;
	commitDialogOpen: boolean;
	selectedCommitId: string | null;
	initialized: boolean;
	autoCommitEnabled: boolean;
	autoCommitIntervalMinutes: number;

	// Actions
	setCurrentBranch: (branch: string) => void;
	setCommits: (commits: Commit[]) => void;
	appendCommits: (commits: Commit[]) => void;
	setIsDirty: (dirty: boolean) => void;
	setLastCommitId: (id: string | null) => void;
	setIsCommitting: (committing: boolean) => void;
	setIsRestoring: (restoring: boolean) => void;
	setIsLoading: (loading: boolean) => void;
	openCommitDialog: () => void;
	closeCommitDialog: () => void;
	selectCommit: (id: string | null) => void;
	setInitialized: (initialized: boolean) => void;
	setAutoCommitEnabled: (enabled: boolean) => void;
	setAutoCommitIntervalMinutes: (minutes: number) => void;

	// Sync from VersionManager
	syncStatus: (status: VersionStatus) => void;
}

export const useVersionStore = create<VersionStore>()((set) => ({
	// Initial state
	currentBranch: "main",
	commits: [],
	isDirty: false,
	lastCommitId: null,
	isCommitting: false,
	isRestoring: false,
	isLoading: false,
	commitDialogOpen: false,
	selectedCommitId: null,
	initialized: false,
	autoCommitEnabled: false,
	autoCommitIntervalMinutes: 10,

	// Actions
	setCurrentBranch: (branch) => set({ currentBranch: branch }),
	setCommits: (commits) => set({ commits }),
	appendCommits: (newCommits) =>
		set((state) => {
			const existingIds = new Set(state.commits.map((c) => c.id));
			const unique = newCommits.filter((c) => !existingIds.has(c.id));
			return { commits: [...state.commits, ...unique] };
		}),
	setIsDirty: (dirty) => set({ isDirty: dirty }),
	setLastCommitId: (id) => set({ lastCommitId: id }),
	setIsCommitting: (committing) => set({ isCommitting: committing }),
	setIsRestoring: (restoring) => set({ isRestoring: restoring }),
	setIsLoading: (loading) => set({ isLoading: loading }),
	openCommitDialog: () => set({ commitDialogOpen: true }),
	closeCommitDialog: () => set({ commitDialogOpen: false }),
	selectCommit: (id) => set({ selectedCommitId: id }),
	setInitialized: (initialized) => set({ initialized }),
	setAutoCommitEnabled: (enabled) => set({ autoCommitEnabled: enabled }),
	setAutoCommitIntervalMinutes: (minutes) =>
		set({ autoCommitIntervalMinutes: minutes }),

	syncStatus: (status) =>
		set({
			currentBranch: status.currentBranch,
			isDirty: status.isDirty,
			lastCommitId: status.lastCommitId,
		}),
}));
