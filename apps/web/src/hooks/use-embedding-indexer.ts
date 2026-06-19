/**
 * Auto-index new media assets for visual search.
 *
 * Watches the media manager and indexes any newly-added video/image assets
 * into the local CLIP embedding store. Audio assets are skipped (no visual
 * signal to embed). Indexing runs in the background — failures surface as
 * console warnings, never blocking the editor.
 *
 * Mount this hook once at the editor level (alongside other always-on hooks
 * like `use-keybindings`).
 */

import { useEffect, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { indexMedia } from "@/services/search/embedding-service";
import {
	listIndexedMediaIds,
	setStatus,
} from "@/services/search/embedding-store";
import type { EmbeddingStatus } from "@/lib/search/embedding-types";

const CLIP_MODEL_NAME = "ViT-B-32";

export function useEmbeddingIndexer() {
	const editor = useEditor();
	const knownIndexedRef = useRef<Set<string>>(new Set());
	const inflightRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		let cancelled = false;

		// On mount, hydrate the "already indexed" set so we don't re-index on reload.
		listIndexedMediaIds()
			.then((ids) => {
				if (cancelled) return;
				knownIndexedRef.current = new Set(ids);
			})
			.catch(() => undefined);

		const tick = async () => {
			if (cancelled) return;
			const assets = editor.media.getAssets();
			const indexedSet = knownIndexedRef.current;
			const inflightSet = inflightRef.current;

			for (const asset of assets) {
				if (indexedSet.has(asset.id) || inflightSet.has(asset.id)) continue;
				if (asset.type !== "video" && asset.type !== "image") {
					// Mark audio/unknown as skipped so we don't keep re-evaluating them.
					indexedSet.add(asset.id);
					setStatus({
						mediaId: asset.id,
						state: "skipped",
						reason: "non-visual media type",
					} satisfies EmbeddingStatus).catch(() => undefined);
					continue;
				}
				if (!asset.url) {
					indexedSet.add(asset.id);
					continue;
				}

				inflightSet.add(asset.id);
				// Fire-and-forget — failures are recorded as EmbeddingStatus "error".
				indexMedia(asset, { modelName: CLIP_MODEL_NAME })
					.catch((err) => {
						console.warn(`[embedding-indexer] failed for ${asset.id}:`, err);
					})
					.finally(() => {
						inflightSet.delete(asset.id);
						indexedSet.add(asset.id);
					});
			}
		};

		// Run on every media change (the manager notifies on add/remove).
		const unsubscribe = editor.media.subscribe(() => {
			// Defer so we don't run during React's commit phase.
			setTimeout(tick, 0);
		});

		// Kick off immediately in case assets were loaded before subscription.
		setTimeout(tick, 500);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [editor]);
}
