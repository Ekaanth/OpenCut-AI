/**
 * Visual / semantic media search.
 *
 * Loads all CLIP embeddings from IndexedDB, embeds the user's natural-language
 * query via the backend, then ranks frames by cosine similarity — entirely
 * on-device after the query embedding is fetched. No media data ever leaves
 * the user's machine after the one-time indexing pass.
 *
 * Debounced (300ms) like `useSoundSearch`. Returns ranked SearchHit[].
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { aiClient } from "@/lib/ai-client";
import {
	getAllEmbeddings,
	getAllStatuses,
	getIndexedCount,
} from "@/services/search/embedding-store";
import type { MediaEmbedding, SearchHit } from "@/lib/search/embedding-types";

export interface VisualSearchState {
	hits: SearchHit[];
	isSearching: boolean;
	error: string | null;
	indexedCount: number;
	/** Assets currently being indexed (mediaId → phase). */
	indexing: Record<string, { phase: string; progress: number }>;
	/** True if at least one media asset has been indexed. */
	hasIndex: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

/**
 * Cosine similarity for two L2-normalized Float32Arrays == dot product.
 * Vectors from CLIP are already normalized on the backend, so this is a
 * tight inner-product loop — fast enough to run across thousands of frames
 * synchronously without dropping a frame.
 */
function dotProduct(a: Float32Array, b: Float32Array): number {
	let sum = 0;
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) sum += a[i] * b[i];
	return sum;
}

export function useVisualSearch() {
	const editor = useEditor();
	const [hits, setHits] = useState<SearchHit[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [indexedCount, setIndexedCount] = useState(0);
	const [indexing, setIndexing] = useState<
		Record<string, { phase: string; progress: number }>
	>({});
	const [hasIndex, setHasIndex] = useState(false);
	const embeddingsRef = useRef<MediaEmbedding[]>([]);
	const lastQueryRef = useRef<string>("");

	/** Refresh the cached embedding index from IndexedDB. */
	const refreshIndex = useCallback(async () => {
		const [all, count, statuses] = await Promise.all([
			getAllEmbeddings(),
			getIndexedCount(),
			getAllStatuses(),
		]);
		embeddingsRef.current = all;
		setIndexedCount(count);
		setHasIndex(all.length > 0);
		const inflight: Record<string, { phase: string; progress: number }> = {};
		for (const s of statuses) {
			if (s.state === "indexing") {
				inflight[s.mediaId] = { phase: s.phase, progress: s.progress };
			}
		}
		setIndexing(inflight);
	}, []);

	/** Run a search query against the cached embedding index. */
	const search = useCallback(
		async (query: string, opts?: { limit?: number; threshold?: number }) => {
			const trimmed = query.trim();
			if (trimmed.length < MIN_QUERY_LEN) {
				setHits([]);
				setError(null);
				lastQueryRef.current = "";
				return;
			}

			setIsSearching(true);
			setError(null);
			try {
				// Pick up media indexed since the last refresh. `count` is a
				// cheap IndexedDB read; only re-read all vectors when it drifts
				// (e.g. background indexing finished after the last media event).
				const liveCount = await getIndexedCount();
				if (embeddingsRef.current.length !== liveCount) {
					await refreshIndex();
				}
				const queryVec = Float32Array.from(
					(await aiClient.embedText(trimmed)).vector,
				);

				const limit = opts?.limit ?? 30;
				const threshold = opts?.threshold ?? 0.18;
				const assets = editor.media.getAssets();
				const byId = new Map(assets.map((a) => [a.id, a]));

				const candidates: SearchHit[] = [];
				for (const media of embeddingsRef.current) {
					const asset = byId.get(media.mediaId);
					if (!asset) continue;
					let bestScore = -Infinity;
					let bestTs = 0;
					for (const frame of media.frames) {
						const score = dotProduct(queryVec, frame.vector);
						if (score > bestScore) {
							bestScore = score;
							bestTs = frame.timestampSec;
						}
					}
					if (bestScore >= threshold) {
						candidates.push({
							mediaId: media.mediaId,
							timestampSec: bestTs,
							score: bestScore,
							mediaName: asset.name,
							mediaType: asset.type,
							thumbnailUrl: asset.thumbnailUrl,
						});
					}
				}
				candidates.sort((a, b) => b.score - a.score);
				setHits(candidates.slice(0, limit));
				lastQueryRef.current = trimmed;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Search failed");
				setHits([]);
			} finally {
				setIsSearching(false);
			}
		},
		[editor.media, refreshIndex],
	);

	/** Debounced search driven by a query string (use in an input's onChange). */
	const debouncedSearch = useCallback(
		(query: string) => {
			const timeoutId = setTimeout(() => search(query), DEBOUNCE_MS);
			return () => clearTimeout(timeoutId);
		},
		[search],
	);

	/** "Find more like this": search by an existing media asset's frames. */
	const findSimilar = useCallback(
		async (mediaId: string, opts?: { limit?: number; threshold?: number }) => {
			setIsSearching(true);
			setError(null);
			try {
				const liveCount = await getIndexedCount();
				if (embeddingsRef.current.length !== liveCount) await refreshIndex();
				const source = embeddingsRef.current.find((m) => m.mediaId === mediaId);
				if (!source || source.frames.length === 0) {
					setHits([]);
					return;
				}
				// Average all source frames into a single query vector.
				const dim = source.frames[0].vector.length;
				const queryVec = new Float32Array(dim);
				for (const f of source.frames) {
					for (let i = 0; i < dim; i++) queryVec[i] += f.vector[i];
				}
				const inv = 1 / source.frames.length;
				let norm = 0;
				for (let i = 0; i < dim; i++) {
					queryVec[i] *= inv;
					norm += queryVec[i] * queryVec[i];
				}
				norm = Math.sqrt(norm) || 1;
				for (let i = 0; i < dim; i++) queryVec[i] /= norm;

				const limit = opts?.limit ?? 30;
				const threshold = opts?.threshold ?? 0.7;
				const assets = editor.media.getAssets();
				const byId = new Map(assets.map((a) => [a.id, a]));
				const candidates: SearchHit[] = [];
				for (const media of embeddingsRef.current) {
					if (media.mediaId === mediaId) continue;
					const asset = byId.get(media.mediaId);
					if (!asset) continue;
					let bestScore = -Infinity;
					let bestTs = 0;
					for (const frame of media.frames) {
						const score = dotProduct(queryVec, frame.vector);
						if (score > bestScore) {
							bestScore = score;
							bestTs = frame.timestampSec;
						}
					}
					if (bestScore >= threshold) {
						candidates.push({
							mediaId: media.mediaId,
							timestampSec: bestTs,
							score: bestScore,
							mediaName: asset.name,
							mediaType: asset.type,
							thumbnailUrl: asset.thumbnailUrl,
						});
					}
				}
				candidates.sort((a, b) => b.score - a.score);
				setHits(candidates.slice(0, limit));
				lastQueryRef.current = `similar:${mediaId}`;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Find similar failed");
				setHits([]);
			} finally {
				setIsSearching(false);
			}
		},
		[editor.media, refreshIndex],
	);

	/** Keep the cached index fresh whenever media changes (imports, deletions). */
	useEffect(() => {
		refreshIndex();
		const unsubscribe = editor.media.subscribe(() => {
			// Defer so we don't run during React commit phase.
			setTimeout(refreshIndex, 200);
		});
		return unsubscribe;
	}, [editor.media, refreshIndex]);

	return {
		hits,
		isSearching,
		error,
		indexedCount,
		indexing,
		hasIndex,
		search,
		debouncedSearch,
		findSimilar,
		refreshIndex,
	} satisfies VisualSearchState & {
		search: typeof search;
		debouncedSearch: typeof debouncedSearch;
		findSimilar: typeof findSimilar;
		refreshIndex: typeof refreshIndex;
	};
}
