import { useCallback, useState, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { executeAction } from "@/lib/ai-action-executor";
import {
	COPILOT_SYSTEM_PROMPT,
	type CopilotPlan,
	type CopilotStep,
	type CopilotStepStatus,
} from "@/lib/copilot/copilot-types";
import { generateUUID } from "@/utils/id";
import { toast } from "sonner";

function buildProjectContext(editor: ReturnType<typeof useEditor>) {
	const tracks = editor.timeline.getTracks();
	const segments = useTranscriptStore.getState().segments;
	const chapters = useTranscriptStore.getState().chapters;
	const project = editor.project.getActiveOrNull();

	return {
		duration: project?.metadata?.duration ?? 0,
		trackCount: tracks.length,
		tracks: tracks.map((t) => ({
			type: t.type,
			elementCount: t.elements.length,
			elements: t.elements.map((el) => ({
				type: el.type,
				name: (el as any).name ?? "",
				startTime: el.startTime,
				duration: el.duration,
			})),
		})),
		segmentCount: segments.length,
		chapterCount: chapters.length,
		settings: project?.settings,
	};
}

export function useCopilot() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [plan, setPlan] = useState<CopilotPlan | null>(null);
	const [isPlanning, setIsPlanning] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const cancelledRef = useRef(false);

	const createPlan = useCallback(
		async (goal: string) => {
			setIsPlanning(true);
			setPlan(null);

			const taskId = `copilot-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "AI Co-Pilot",
				progress: "Creating plan...",
			});

			try {
				const context = buildProjectContext(editor);

				const response = await aiClient.chat(
					`Goal: ${goal}\n\nCurrent project state:\n${JSON.stringify(context, null, 2)}`,
					COPILOT_SYSTEM_PROMPT,
				);

				const jsonMatch = response.response.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error("AI did not return a valid plan");
				}

				const parsed = JSON.parse(jsonMatch[0]);
				const steps: CopilotStep[] = (parsed.steps ?? []).map(
					(s: any, i: number) => ({
						id: s.id ?? `step-${i + 1}`,
						description: s.description ?? `Step ${i + 1}`,
						action: s.action,
						status: "pending" as CopilotStepStatus,
					}),
				);

				const copilotPlan: CopilotPlan = {
					goal,
					steps,
					estimatedTime: parsed.estimatedTime ?? "A few seconds",
					requiresConfirmation: parsed.requiresConfirmation ?? true,
				};

				setPlan(copilotPlan);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Plan created: ${steps.length} steps`,
					completedAt: Date.now(),
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Planning failed";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Co-Pilot planning failed", { description: msg });
			} finally {
				setIsPlanning(false);
			}
		},
		[editor, bgTasks],
	);

	const executePlan = useCallback(async () => {
		if (!plan) return;

		setIsExecuting(true);
		cancelledRef.current = false;

		const taskId = `copilot-exec-${Date.now()}`;
		bgTasks.addTask({
			id: taskId,
			type: "broll-suggestions",
			label: "Co-Pilot Executing",
			progress: `Executing ${plan.steps.length} steps...`,
		});

		for (let i = 0; i < plan.steps.length; i++) {
			if (cancelledRef.current) {
				setPlan((prev) => {
					if (!prev) return prev;
					const updated = { ...prev };
					updated.steps = updated.steps.map((s, j) =>
						j >= i ? { ...s, status: "cancelled" as CopilotStepStatus } : s,
					);
					return updated;
				});
				break;
			}

			setPlan((prev) => {
				if (!prev) return prev;
				const updated = { ...prev };
				updated.steps = updated.steps.map((s, j) =>
					j === i ? { ...s, status: "running" as CopilotStepStatus } : s,
				);
				return updated;
			});

			const step = plan.steps[i];

			try {
				if (step.action) {
					executeAction(step.action);
				}

				setPlan((prev) => {
					if (!prev) return prev;
					const updated = { ...prev };
					updated.steps = updated.steps.map((s, j) =>
						j === i ? { ...s, status: "completed" as CopilotStepStatus } : s,
					);
					return updated;
				});

				bgTasks.updateTask(taskId, {
					progress: `Step ${i + 1}/${plan.steps.length} done`,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Step failed";
				setPlan((prev) => {
					if (!prev) return prev;
					const updated = { ...prev };
					updated.steps = updated.steps.map((s, j) =>
						j === i
							? { ...s, status: "error" as CopilotStepStatus, error: msg }
							: s,
					);
					return updated;
				});
			}

			await new Promise((r) => setTimeout(r, 200));
		}

		setIsExecuting(false);

		bgTasks.updateTask(taskId, {
			status: "completed",
			progress: "Co-Pilot execution complete",
			completedAt: Date.now(),
		});

		toast.success("Co-Pilot finished executing plan");
	}, [plan, bgTasks]);

	const cancel = useCallback(() => {
		cancelledRef.current = true;
		setIsExecuting(false);
	}, []);

	const reset = useCallback(() => {
		setPlan(null);
		setIsPlanning(false);
		setIsExecuting(false);
		cancelledRef.current = false;
	}, []);

	return {
		plan,
		isPlanning,
		isExecuting,
		createPlan,
		executePlan,
		cancel,
		reset,
	};
}
