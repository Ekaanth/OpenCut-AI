/**
 * Visual / semantic search types.
 *
 * The embedding pipeline samples N frames per media asset (1 per ~2 seconds by
 * default), encodes each frame into a 512-dim CLIP vector, and stores the
 * vector + timestamp in IndexedDB keyed by mediaId. At query time, the user's
 * natural-language query is encoded into the same 512-dim space and cosine
 * similarity is computed client-side against every stored frame.
 *
 * Privacy note: embeddings are stored locally in IndexedDB — no vector data
 * ever leaves the user's machine. The backend only computes embeddings on
 * demand and forgets the input frames immediately.
 */

/** A single sampled frame's embedding. */
export interface EmbeddingFrame {
	/** Seconds offset from media start. */
	timestampSec: number;
	/** L2-normalized 512-dim CLIP vector. */
	vector: Float32Array;
}

/** Per-media embedding record persisted in IndexedDB. */
export interface MediaEmbedding {
	id: string;
	/** Foreign key to MediaAsset.id. */
	mediaId: string;
	/** Sampled frames and their embeddings. */
	frames: EmbeddingFrame[];
	/** When the index was created (epoch ms). */
	createdAt: number;
	/** CLIP model name that produced the vectors (for invalidation on upgrade). */
	modelName: string;
	/** Auto-detected zero-shot tags (top-5 candidate labels). */
	tags: ZeroShotTag[];
}

/** Indexing progress reported during embed-on-import. */
export interface IndexingProgress {
	mediaId: string;
	phase: "sampling" | "embedding" | "done" | "error";
	/** 0-1 fraction complete. */
	progress: number;
	error?: string;
}

/** A candidate label scored against a frame via CLIP zero-shot. */
export interface ZeroShotTag {
	label: string;
	/** Cosine similarity in [-1, 1]; higher = more relevant. */
	score: number;
}

/** Status of a media asset in the embedding index. */
export type EmbeddingStatus =
	| { state: "pending"; mediaId: string }
	| {
			state: "indexing";
			mediaId: string;
			progress: number;
			phase: IndexingProgress["phase"];
	  }
	| { state: "indexed"; mediaId: string; frameCount: number; createdAt: number }
	| { state: "error"; mediaId: string; error: string }
	| { state: "skipped"; mediaId: string; reason: string };

/** One search hit returned by {@link useVisualSearch}. */
export interface SearchHit {
	mediaId: string;
	/** Best-matching frame timestamp within the media asset. */
	timestampSec: number;
	/** Cosine similarity in [-1, 1]. */
	score: number;
	/** Reference to the MediaAsset (resolved by the hook). */
	mediaName?: string;
	mediaType?: "video" | "image" | "audio";
	/** Optional thumbnail data URL for the matching frame. */
	thumbnailUrl?: string;
}

/** Candidate label set used for auto-tagging on import. */
export const ZERO_SHOT_LABELS = [
	"outdoor",
	"indoor",
	"face",
	"people talking",
	"screen recording",
	"nature",
	"city",
	"office",
	"food",
	"vehicle",
	"animal",
	"text on screen",
	"animation",
	"product shot",
	"concert",
	"sports",
	"interview",
	"b-roll",
	"landscape",
	"close-up",
] as const;

/** Default frame sampling rate (one frame every N seconds). */
export const DEFAULT_SAMPLE_INTERVAL_SEC = 2;

/** Cosine similarity above which two clips are flagged as near-duplicates. */
export const DUPLICATE_THRESHOLD = 0.98;
