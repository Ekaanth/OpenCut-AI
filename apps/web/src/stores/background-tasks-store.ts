import { create } from "zustand";
import { toast } from "sonner";

export type BackgroundTaskStatus = "running" | "completed" | "error";

export interface BackgroundTask {
	id: string;
	type: "transcription" | "voiceover" | "translation" | "tts" | "clip-finder" | "keyword-extraction" | "question-cards" | "popover-subs" | "speaker-diarization" | "template-generation";
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
		updates: Partial<Pick<BackgroundTask, "progress" | "status" | "error" | "completedAt">>,
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
			set((state) => ({
				tasks: state.tasks.map((t) =>
					t.id === id ? { ...t, ...updates } : t,
				),
			}));

			// Show toast on error
			if (updates.status === "error" && updates.error) {
				const task = get().tasks.find((t) => t.id === id);
				toast.error(`${task?.label ?? "Task"} failed`, {
					description: updates.error,
				});
			}

			// Show toast on completion
			if (updates.status === "completed") {
				const task = get().tasks.find((t) => t.id === id);
				toast.success(`${task?.label ?? "Task"} completed`);
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
