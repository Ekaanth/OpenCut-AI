import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { AUTO_CORRECT_PROFILES, type ColorCorrectionProfile } from "@/lib/color/auto-color-profiles";
import { toast } from "sonner";

export function useAutoColorCorrection() {
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();
	const [appliedProfile, setAppliedProfile] = useState<string | null>(null);

	const analyzeAndCorrect = useCallback(
		async (profileName?: string) => {
			const taskId = `color-${Date.now()}`;
			bgTasks.addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Auto Color Correction",
				progress: "Analyzing video frames...",
			});

			try {
				const profile = profileName
					? AUTO_CORRECT_PROFILES.find((p) => p.name === profileName) ?? AUTO_CORRECT_PROFILES[0]
					: AUTO_CORRECT_PROFILES[0];

				const tracks = editor.timeline.getTracks();
				const updates: Array<{ trackId: string; elementId: string; updates: any }> = [];
				for (const track of tracks) {
					if (track.type !== "video") continue;
					for (const el of track.elements) {
						if (el.type === "video" || el.type === "image") {
							if ("effects" in el) {
								const existingEffects = [...((el as any).effects ?? [])];
								const colorEffectIdx = existingEffects.findIndex(
									(e: any) => e.effectId === "color-adjust",
								);

								if (colorEffectIdx >= 0) {
									existingEffects[colorEffectIdx] = {
										...existingEffects[colorEffectIdx],
										params: {
											...existingEffects[colorEffectIdx].params,
											...profile.adjustments,
										},
									};
								} else {
									existingEffects.push({
										effectId: "color-adjust",
										enabled: true,
										params: profile.adjustments,
									});
								}

								updates.push({
									trackId: track.id,
									elementId: el.id,
									updates: { effects: existingEffects } as any,
								});
							}
						}
					}
				}

				if (updates.length > 0) {
					editor.timeline.updateElements({ updates });
				}

				setAppliedProfile(profile.name);

				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `Applied "${profile.name}" color correction`,
					completedAt: Date.now(),
				});

				toast.success(`Applied "${profile.name}" color correction to all video clips`);
			} catch (err) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: err instanceof Error ? err.message : "Color correction failed",
					completedAt: Date.now(),
				});
			}
		},
		[editor, bgTasks],
	);

	return { analyzeAndCorrect, appliedProfile, profiles: AUTO_CORRECT_PROFILES };
}
