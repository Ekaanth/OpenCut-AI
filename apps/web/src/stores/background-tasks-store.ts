import { create } from "zustand";
import { toast } from "sonner";

export type BackgroundTaskStatus = "running" | "completed" | "error";

export interface BackgroundTask {
	id: string;
	type:
		| "transcription"
		| "voiceover"
		| "translation"
		| "tts"
		| "clip-finder"
		| "keyword-extraction"
		| "question-cards"
		| "popover-subs"
		| "speaker-diarization"
		| "template-generation"
		| "broll-suggestions"
		| "broll-batch"
		| "smart-cut"
		| "proxy-generation"
		| "dubbing";
	label: string;
	status: BackgroundTaskStatus;
	progress: string;
	startedAt: number;
	completedAt?: number;
	error?: string;
}

interface BackgroundTasksState {
	tasks: BackgroundTask[];
	isMinimized: boolean;

	addTask: (task: Omit<BackgroundTask, "startedAt" | "status">) => void;
	updateTask: (
		id: string,
		updates: Partial<
			Pick<BackgroundTask, "progress" | "status" | "error" | "completedAt">
		>,
	) => void;
	removeTask: (id: string) => void;
	clearCompleted: () => void;
	setMinimized: (minimized: boolean) => void;
}

export const useBackgroundTasksStore = create<BackgroundTasksState>(
	(set, get) => ({
		tasks: [],
		isMinimized: false,

		addTask: (task) => {
			set((state) => ({
				tasks: [
					...state.tasks,
					{ ...task, status: "running" as const, startedAt: Date.now() },
				],
				isMinimized: false,
			}));
		},

		updateTask: (id, updates) => {
			// Guard: don't re-notify if task is already in a terminal state
			const existing = get().tasks.find((t) => t.id === id);
			if (!existing) return;
			const wasTerminal =
				existing.status === "completed" || existing.status === "error";

			set((state) => ({
				tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
			}));

			// Only toast on the first transition to a terminal state
			if (wasTerminal) return;

			if (updates.status === "error" && updates.error) {
				toast.error(`${existing.label} failed`, {
					description: updates.error,
				});
			}

			if (updates.status === "completed") {
				toast.success(`${existing.label} completed`);
			}
		},

		removeTask: (id) => {
			set((state) => ({
				tasks: state.tasks.filter((t) => t.id !== id),
			}));
		},

		clearCompleted: () => {
			set((state) => ({
				tasks: state.tasks.filter((t) => t.status === "running"),
			}));
		},

		setMinimized: (minimized) => {
			set({ isMinimized: minimized });
		},
	}),
);
