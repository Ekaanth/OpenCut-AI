"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { getAllEmbeddings } from "@/services/search/embedding-store";
import type { MediaEmbedding } from "@/lib/search/embedding-types";
import { toast } from "sonner";

export interface BRollMatch {
	mediaId: string;
	timestampSec: number;
	score: number;
	mediaName: string;
	thumbnailUrl?: string;
}

export interface BRollSuggestion {
	segmentIndex: number;
	start: number;
	end: number;
	text: string;
	matches: BRollMatch[];
}

export interface AutoBRollResult {
	suggestions: BRollSuggestion[];
	indexedAssets: number;
	matched: number;
}

export interface AutoBRollOptions {
	/** Top-K matches to keep per segment. Default 3. */
	topK?: number;
	/** Minimum cosine similarity to accept a match. Default 0.20. */
	threshold?: number;
	/** Skip segments shorter than this (seconds) — too-short b-roll looks bad. Default 2.0. */
	minSegmentDuration?: number;
	/** When true, insert the best match for each segment as a video overlay. */
	autoApply?: boolean;
}

/**
 * Cosine similarity for L2-normalized vectors == dot product. Mirrors
 * `useVisualSearch` since CLIP vectors are normalized on the backend.
 */
function dotProduct(a: Float32Array, b: number[] | Float32Array): number {
	let sum = 0;
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) sum += a[i] * b[i];
	return sum;
}

/**
 * Auto B-roll: match each transcript segment against the existing CLIP
 * embedding index (same index visual search uses) and surface the best
 * footage for each. Optionally auto-insert the top match as an overlay.
 *
 * Reuses the IndexedDB embedding store — there is no parallel index. If the
 * library isn't indexed yet, the hook surfaces that and offers to index.
 */
export function useAutoBRoll() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState<{
		current: number;
		total: number;
		phase: string;
	} | null>(null);
	const [result, setResult] = useState<AutoBRollResult | null>(null);
	const embeddingsRef = useRef<MediaEmbedding[]>([]);

	const indexAsset = useCallback(
		async (mediaId: string) => {
			const { indexMedia } = await import("@/services/search/embedding-service");
			const asset = editor.media.getAssets().find((a) => a.id === mediaId);
			if (!asset) {
				toast.error("Asset not found.");
				return null;
			}
			return indexMedia(asset, {
				onProgress: (p) =>
					setProgress({
						current: 0,
						total: 0,
						phase: `${p.phase} (${Math.round(p.progress * 100)}%)`,
					}),
			});
		},
		[editor.media],
	);

	const indexAll = useCallback(async () => {
		const { indexMediaBatch } = await import(
			"@/services/search/embedding-service"
		);
		const assets = editor.media.getAssets().filter(
			(a) => a.type === "video" || a.type === "image",
		);
		if (assets.length === 0) {
			toast.error("No video or image assets to index.");
			return;
		}
		setIsRunning(true);
		const taskId = `broll-index-${Date.now()}`;
		useBackgroundTasksStore.getState().addTask({
			id: taskId,
			type: "broll-suggestions",
			label: "Indexing assets for B-roll",
			progress: `0/${assets.length} assets`,
		});
		try {
			await indexMediaBatch(assets, {
				onProgress: (mediaId, fraction, phase) => {
					useBackgroundTasksStore.getState().updateTask(taskId, {
						progress: `${mediaId.slice(0, 6)}… ${phase} ${Math.round(fraction * 100)}%`,
					});
				},
			});
			useBackgroundTasksStore.getState().updateTask(taskId, {
				status: "completed",
				progress: `${assets.length}/${assets.length} indexed`,
				completedAt: Date.now(),
			});
			toast.success(`Indexed ${assets.length} assets for B-roll.`);
		} catch (err) {
			useBackgroundTasksStore.getState().updateTask(taskId, {
				status: "error",
				error: err instanceof Error ? err.message : "Indexing failed",
				completedAt: Date.now(),
			});
		} finally {
			setIsRunning(false);
			setProgress(null);
		}
	}, [editor.media]);

	const applyMatch = useCallback(
		(match: BRollMatch, start: number, end: number) => {
			const asset = editor.media.getAssets().find((a) => a.id === match.mediaId);
			if (!asset) return;
			// Place on a dedicated B-roll track above the timeline.
			const tracks = editor.timeline.getTracks();
			let brollTrackId = tracks.find(
				(t) => t.type === "video" && t.id.startsWith("broll-"),
			)?.id;
			if (!brollTrackId) {
				brollTrackId = editor.timeline.addTrack({ type: "video" });
			}
			const baseTransform = { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };
			if (asset.type === "video") {
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: brollTrackId },
					element: {
						type: "video",
						mediaId: match.mediaId,
						name: `B-roll: ${match.mediaName}`,
						startTime: start,
						duration: end - start,
						trimStart: match.timestampSec,
						trimEnd: 0,
						sourceDuration: asset.duration,
						transform: baseTransform,
						opacity: 1,
					},
				});
			} else if (asset.type === "image") {
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: brollTrackId },
					element: {
						type: "image",
						mediaId: match.mediaId,
						name: `B-roll: ${match.mediaName}`,
						startTime: start,
						duration: end - start,
						trimStart: 0,
						trimEnd: 0,
						transform: baseTransform,
						opacity: 1,
					},
				});
			}
		},
		[editor],
	);

	const run = useCallback(
		async (options: AutoBRollOptions = {}) => {
			const topK = options.topK ?? 3;
			const threshold = options.threshold ?? 0.2;
			const minDur = options.minSegmentDuration ?? 2.0;
			const autoApply = options.autoApply ?? false;

			// Load (or refresh) the embedding index.
			embeddingsRef.current = await getAllEmbeddings();
			if (embeddingsRef.current.length === 0) {
				toast.error(
					"No indexed footage yet. Index your assets first (button below).",
				);
				return null;
			}
			if (segments.length === 0) {
				toast.error("No transcript. Transcribe first.");
				return null;
			}

			setIsRunning(true);
			const taskId = `broll-${Date.now()}`;
			useBackgroundTasksStore.getState().addTask({
				id: taskId,
				type: "broll-suggestions",
				label: "Auto B-roll",
				progress: `0/${segments.length} segments`,
			});

			const assets = editor.media.getAssets();
			const byId = new Map(assets.map((a) => [a.id, a]));
			const suggestions: BRollSuggestion[] = [];
			let matched = 0;

			try {
				for (let i = 0; i < segments.length; i++) {
					const seg = segments[i];
					setProgress({ current: i + 1, total: segments.length, phase: "matching" });
					if (seg.end - seg.start < minDur || !seg.text.trim()) continue;

					// Embed this segment's text once, rank against all frames.
					let queryVec: Float32Array;
					try {
						const v = await aiClient.embedBRollQuery(seg.text);
						queryVec = Float32Array.from(v);
					} catch {
						continue;
					}

					const candidates: BRollMatch[] = [];
					for (const media of embeddingsRef.current) {
						const asset = byId.get(media.mediaId);
						if (!asset) continue;
						for (const frame of media.frames) {
							const score = dotProduct(queryVec, frame.vector);
							if (score >= threshold) {
								candidates.push({
									mediaId: media.mediaId,
									timestampSec: frame.timestampSec,
									score,
									mediaName: asset.name,
									thumbnailUrl: asset.thumbnailUrl,
								});
							}
						}
					}
					candidates.sort((a, b) => b.score - a.score);
					const top = candidates.slice(0, topK);
					if (top.length > 0) matched++;

					const suggestion: BRollSuggestion = {
						segmentIndex: i,
						start: seg.start,
						end: seg.end,
						text: seg.text,
						matches: top,
					};
					suggestions.push(suggestion);

					if (autoApply && top.length > 0) {
						applyMatch(top[0], seg.start, seg.end);
					}

					if (i % 3 === 0) {
						useBackgroundTasksStore.getState().updateTask(taskId, {
							progress: `${i + 1}/${segments.length} segments`,
						});
					}
				}

				const out: AutoBRollResult = {
					suggestions,
					indexedAssets: embeddingsRef.current.length,
					matched,
				};
				setResult(out);
				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "completed",
					progress: `${matched}/${suggestions.length} segments matched`,
					completedAt: Date.now(),
				});
				toast.success(
					autoApply
						? `Applied B-roll to ${matched} segments.`
						: `Found B-roll for ${matched} of ${suggestions.length} segments.`,
				);
				return out;
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Auto B-roll failed";
				useBackgroundTasksStore.getState().updateTask(taskId, {
					status: "error",
					error: msg,
					completedAt: Date.now(),
				});
				toast.error("Auto B-roll failed", { description: msg });
				return null;
			} finally {
				setIsRunning(false);
				setProgress(null);
			}
		},
		[segments, editor, applyMatch],
	);

	return {
		run,
		indexAll,
		indexAsset,
		applyMatch,
		isRunning,
		progress,
		result,
	};
}
