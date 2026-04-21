"use client";

import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { hasMediaId, getElementsAtTime } from "@/lib/timeline";
import { mergeTimeRanges, type TimeRange } from "@/lib/text-timeline-sync";
import {
	captureTranscriptSnapshot,
	hasTranscriptChanged,
	TranscriptSnapshotCommand,
} from "@/lib/commands/transcript";
import type { TimelineElement } from "@/types/timeline";

export function useSmartCut() {
	const editor = useEditor();

	const runSmartCut = useCallback(async () => {
		const tracks = editor.timeline.getTracks();
		let foundFile: File | null = null;

		for (const track of tracks) {
			for (const element of track.elements) {
				if (
					(track.type === "video" || track.type === "audio") &&
					hasMediaId(element as TimelineElement)
				) {
					const mediaId = (element as TimelineElement & { mediaId: string })
						.mediaId;
					const asset = editor.media.getAssets().find((a) => a.id === mediaId);
					if (asset?.file) {
						foundFile = asset.file;
						break;
					}
				}
			}
			if (foundFile) break;
		}

		if (!foundFile) return null;

		const taskId = `smart-cut-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		bgTasks.addTask({
			id: taskId,
			type: "smart-cut",
			label: "Smart Cut",
			progress: "Analyzing audio...",
		});

		try {
			bgTasks.updateTask(taskId, {
				progress: "Detecting filler words and silences...",
			});

			const [fillerResult, silenceResult] = await Promise.all([
				aiClient.analyzeFillers(foundFile),
				aiClient.analyzeSilences(foundFile),
			]);

			const fillerRanges: TimeRange[] = fillerResult.fillers.map((f) => ({
				start: f.start,
				end: f.end,
			}));
			const silenceRanges: TimeRange[] = silenceResult.silences.map((s) => ({
				start: s.start,
				end: s.end,
			}));
			const allCuts = mergeTimeRanges([...fillerRanges, ...silenceRanges]);

			if (allCuts.length === 0) {
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: "No filler words or silences found",
					completedAt: Date.now(),
				});
				return { cuts: 0, timeSaved: 0 };
			}

			const totalTimeSaved = allCuts.reduce(
				(sum, c) => sum + (c.end - c.start),
				0,
			);

			bgTasks.updateTask(taskId, {
				progress: `Applying ${allCuts.length} cuts...`,
			});

			const supportsTransaction =
				typeof editor.command.beginTransaction === "function";
			const transcriptBefore = captureTranscriptSnapshot();

			if (supportsTransaction) editor.command.beginTransaction();

			applyTimeRangeCuts(editor, allCuts);

			const segments = useTranscriptStore.getState().segments;
			const segsToRemove: number[] = [];
			for (const seg of segments) {
				const segWords = seg.words;
				if (segWords.length === 0) continue;
				const fillerWordCount = segWords.filter((w) =>
					isFillerWord(w.word),
				).length;
				if (fillerWordCount / segWords.length >= 0.8) {
					segsToRemove.push(Number(seg.id));
				}
			}

			if (segsToRemove.length > 0) {
				useTranscriptStore
					.getState()
					.deleteSegments(segsToRemove.filter((n) => !isNaN(n)));
			}

			compactTimeline(editor);

			if (supportsTransaction) {
				const transcriptAfter = captureTranscriptSnapshot();
				if (hasTranscriptChanged(transcriptBefore, transcriptAfter)) {
					editor.command.push({
						command: new TranscriptSnapshotCommand(
							transcriptBefore,
							transcriptAfter,
						),
					});
				}
				editor.command.commitTransaction();
			}

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `Removed ${allCuts.length} sections (${totalTimeSaved.toFixed(1)}s saved)`,
				completedAt: Date.now(),
			});

			return { cuts: allCuts.length, timeSaved: totalTimeSaved };
		} catch (err) {
			const message = err instanceof Error ? err.message : "Smart Cut failed";
			bgTasks.updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
			return null;
		}
	}, [editor]);

	return { runSmartCut };
}

function applyTimeRangeCuts(
	editor: ReturnType<typeof useEditor>,
	cuts: TimeRange[],
) {
	if (cuts.length === 0) return;

	const sortedCuts = [...cuts].sort((a, b) => b.start - a.start);

	for (const cut of sortedCuts) {
		const elementsAtStart = getElementsAtTime({
			tracks: editor.timeline.getTracks(),
			time: cut.start,
		});
		if (elementsAtStart.length > 0) {
			editor.timeline.splitElements({
				elements: elementsAtStart,
				splitTime: cut.start,
			});
		}

		const elementsAtEnd = getElementsAtTime({
			tracks: editor.timeline.getTracks(),
			time: cut.end,
		});
		if (elementsAtEnd.length > 0) {
			editor.timeline.splitElements({
				elements: elementsAtEnd,
				splitTime: cut.end,
			});
		}

		const currentTracks = editor.timeline.getTracks();
		const elementsToDelete: { trackId: string; elementId: string }[] = [];

		for (const track of currentTracks) {
			for (const element of track.elements) {
				if (
					element.startTime >= cut.start - 0.01 &&
					element.startTime + element.duration <= cut.end + 0.01
				) {
					elementsToDelete.push({
						trackId: track.id,
						elementId: element.id,
					});
				}
			}
		}

		if (elementsToDelete.length > 0) {
			editor.timeline.deleteElements({
				elements: elementsToDelete,
				rippleEnabled: true,
			});
		}
	}

	compactTimeline(editor);
}

function compactTimeline(editor: ReturnType<typeof useEditor>) {
	const tracks = editor.timeline.getTracks();
	const updates: Array<{
		trackId: string;
		elementId: string;
		updates: Partial<TimelineElement>;
	}> = [];

	for (const track of tracks) {
		const sorted = [...track.elements].sort(
			(a, b) => a.startTime - b.startTime,
		);
		let cursor = sorted[0]?.startTime ?? 0;
		if (sorted.length > 0 && cursor > 0.01) {
			cursor = 0;
		}

		for (const element of sorted) {
			if (Math.abs(element.startTime - cursor) > 0.01) {
				updates.push({
					trackId: track.id,
					elementId: element.id,
					updates: { startTime: cursor },
				});
			}
			cursor += element.duration;
		}
	}

	if (updates.length > 0) {
		editor.timeline.updateElements({ updates });
	}
}

const FILLER_WORDS = new Set([
	"um",
	"uh",
	"like",
	"you know",
	"so",
	"basically",
	"actually",
	"literally",
	"right",
	"well",
	"er",
	"ah",
	"hmm",
	"huh",
	"okay",
	"ok",
]);

function isFillerWord(word: string): boolean {
	return FILLER_WORDS.has(
		word
			.toLowerCase()
			.replace(/[.,!?]/g, "")
			.trim(),
	);
}
