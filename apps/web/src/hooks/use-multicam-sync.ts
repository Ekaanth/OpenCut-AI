"use client";

import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import {
	syncAngles,
	type SyncOffset,
	type SyncResult,
} from "@/lib/multicam/multicam-sync";
import { shiftTracksByOffset } from "@/lib/timeline-edits";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { toast } from "sonner";

/**
 * Auto multicam sync via client-side audio cross-correlation.
 *
 * Computes per-angle offsets relative to a reference angle, shows them for
 * preview, then applies them by shifting each angle's video elements'
 * `startTime`. The apply step is wrapped in a transaction so one undo reverts
 * every angle at once.
 */
export function useMulticamSync() {
	const editor = useEditor();
	const [isSyncing, setIsSyncing] = useState(false);
	const [progressMsg, setProgressMsg] = useState<string | null>(null);
	const [previewOffsets, setPreviewOffsets] = useState<SyncOffset[] | null>(null);
	const [lastResult, setLastResult] = useState<SyncResult | null>(null);

	/** Compute offsets without applying. Populates `previewOffsets`. */
	const compute = useCallback(
		async (referenceTrackId?: string, searchWindowSec = 60) => {
			const tracks = editor.timeline.getTracks();
			const videoTracks = tracks.filter((t) => t.type === "video");
			if (videoTracks.length < 2) {
				toast.error("Add at least 2 video tracks (angles) to sync.");
				return null;
			}
			const refId = referenceTrackId ?? videoTracks[0].id;

			setIsSyncing(true);
			setProgressMsg("Starting…");
			setPreviewOffsets(null);

			const taskId = `multicam-sync-${Date.now()}`;
			useBackgroundTasksStore.getState().addTask({
				id: taskId,
				type: "proxy-generation",
				label: "Multicam sync",
				progress: "Analyzing audio…",
			});

			try {
				const result = await syncAngles(tracks, refId, editor, {
					searchWindowSec,
					onProgress: (msg) => {
						setProgressMsg(msg);
						useBackgroundTasksStore.getState().updateTask(taskId, { progress: msg });
					},
				});
				setPreviewOffsets(result.offsets);
				setLastResult(result);

				const skipped = result.offsets.filter((o) => o.skipped).length;
				const confident = result.offsets.filter((o) => !o.skipped && o.score >= 0.5).length;
				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "completed",
					progress: `${confident} confident${skipped ? `, ${skipped} skipped` : ""}`,
					completedAt: Date.now(),
				});
				toast.success(
					`Sync analysis done — ${confident} angle${confident === 1 ? "" : "s"} aligned` +
						(skipped > 0 ? ` (${skipped} skipped)` : "") +
						". Review and apply.",
				);
				return result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Sync failed";
				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Multicam sync failed", { description: msg });
				return null;
			} finally {
				setIsSyncing(false);
				setProgressMsg(null);
			}
		},
		[editor],
	);

	/** Apply the previously-computed preview offsets to the timeline. */
	const apply = useCallback(() => {
		if (!previewOffsets || previewOffsets.length === 0) {
			toast.error("Compute offsets first.");
			return;
		}
		const supportsTx = typeof editor.command.beginTransaction === "function";
		if (supportsTx) editor.command.beginTransaction();
		let applied = 0;
		for (const off of previewOffsets) {
			if (off.skipped || off.offsetSeconds === 0) continue;
			shiftTracksByOffset(editor, [off.trackId], off.offsetSeconds);
			applied += 1;
		}
		if (supportsTx) editor.command.commitTransaction();
		toast.success(
			applied > 0
				? `Aligned ${applied} angle${applied === 1 ? "" : "s"} to the reference.`
				: "No offsets to apply.",
		);
	}, [editor, previewOffsets]);

	const clearPreview = useCallback(() => {
		setPreviewOffsets(null);
		setLastResult(null);
	}, []);

	return {
		compute,
		apply,
		clearPreview,
		isSyncing,
		progressMsg,
		previewOffsets,
		lastResult,
	};
}
