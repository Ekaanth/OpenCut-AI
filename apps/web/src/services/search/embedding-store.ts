/**
 * IndexedDB-backed store for CLIP embeddings.
 *
 * Opens its own database (`opencut-embeddings`) so it doesn't collide with
 * the project storage adapter or the git-like version store. Vectors are kept
 * locally only — never synced, never uploaded — preserving the privacy-first
 * promise.
 *
 * Two object stores:
 *   - `embeddings`:  keyed by mediaId, holds the per-asset MediaEmbedding
 *   - `status`:       keyed by mediaId, holds the latest EmbeddingStatus
 */

import type {
	EmbeddingStatus,
	MediaEmbedding,
} from "@/lib/search/embedding-types";

const DB_NAME = "opencut-embeddings";
const DB_VERSION = 1;
const EMBEDDINGS_STORE = "embeddings";
const STATUS_STORE = "status";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("IndexedDB is not available in this environment"));
			return;
		}
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(EMBEDDINGS_STORE)) {
				const store = db.createObjectStore(EMBEDDINGS_STORE, {
					keyPath: "mediaId",
				});
				store.createIndex("createdAt", "createdAt");
			}
			if (!db.objectStoreNames.contains(STATUS_STORE)) {
				db.createObjectStore(STATUS_STORE, { keyPath: "mediaId" });
			}
		};
	});
	return dbPromise;
}

function tx<T>(
	storeName: string,
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return openDB().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const transaction = db.transaction(storeName, mode);
				const store = transaction.objectStore(storeName);
				const req = run(store);
				req.onerror = () => reject(req.error);
				req.onsuccess = () => resolve(req.result);
			}),
	);
}

/** Persist (or replace) the embedding record for a media asset. */
export async function saveEmbedding(record: MediaEmbedding): Promise<void> {
	await tx(EMBEDDINGS_STORE, "readwrite", (store) => store.put(record));
}

/** Fetch the embedding record for a media asset, if any. */
export async function getEmbedding(
	mediaId: string,
): Promise<MediaEmbedding | undefined> {
	return tx<MediaEmbedding | undefined>(EMBEDDINGS_STORE, "readonly", (store) =>
		store.get(mediaId),
	);
}

/** Fetch every indexed media embedding (used for cross-media similarity search). */
export async function getAllEmbeddings(): Promise<MediaEmbedding[]> {
	return tx<MediaEmbedding[]>(EMBEDDINGS_STORE, "readonly", (store) =>
		store.getAll(),
	);
}

/** Drop the embedding record for one media asset (called on media delete). */
export async function deleteEmbedding(mediaId: string): Promise<void> {
	await Promise.all([
		tx(EMBEDDINGS_STORE, "readwrite", (store) => store.delete(mediaId)),
		tx(STATUS_STORE, "readwrite", (store) => store.delete(mediaId)),
	]);
}

/** Drop every embedding (used by the Settings → Clear Indexed Data action). */
export async function clearAllEmbeddings(): Promise<void> {
	await Promise.all([
		tx(EMBEDDINGS_STORE, "readwrite", (store) => store.clear()),
		tx(STATUS_STORE, "readwrite", (store) => store.clear()),
	]);
}

/** List mediaIds that already have an embedding record. */
export async function listIndexedMediaIds(): Promise<string[]> {
	return tx<IDBValidKey[]>(EMBEDDINGS_STORE, "readonly", (store) =>
		store.getAllKeys(),
	).then((keys) => keys as string[]);
}

/** Persist the latest indexing status for a media asset. */
export async function setStatus(status: EmbeddingStatus): Promise<void> {
	await tx(STATUS_STORE, "readwrite", (store) => store.put(status));
}

/** Read the indexing status for a media asset. */
export async function getStatus(
	mediaId: string,
): Promise<EmbeddingStatus | undefined> {
	return tx<EmbeddingStatus | undefined>(STATUS_STORE, "readonly", (store) =>
		store.get(mediaId),
	);
}

/** Read the indexing status for every media asset. */
export async function getAllStatuses(): Promise<EmbeddingStatus[]> {
	return tx<EmbeddingStatus[]>(STATUS_STORE, "readonly", (store) =>
		store.getAll(),
	);
}

/** Count of currently-indexed media assets. */
export async function getIndexedCount(): Promise<number> {
	return tx<number>(EMBEDDINGS_STORE, "readonly", (store) => store.count());
}
