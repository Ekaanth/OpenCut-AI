import type { TScene } from "./timeline";
import type { TProjectSettings } from "./project";

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Serialized snapshot stored in IndexedDB.
 * Dates become ISO strings, matching existing SerializedScene pattern.
 */
export interface SerializedVersionSnapshot {
	scenes: SerializedSnapshotScene[];
	settings: TProjectSettings;
	currentSceneId: string;
}

export type SerializedSnapshotScene = Omit<TScene, "createdAt" | "updatedAt"> & {
	createdAt: string;
	updatedAt: string;
};

// ─── Change Summary ──────────────────────────────────────────────────────────

export interface ChangeSummary {
	tracksAdded: number;
	tracksRemoved: number;
	elementsAdded: number;
	elementsRemoved: number;
	elementsModified: number;
	propertiesChanged: string[];
}

// ─── Commits ─────────────────────────────────────────────────────────────────

export interface Commit {
	id: string;
	parentId: string | null;
	projectId: string;
	timestamp: string; // ISO 8601
	message: string;
	author: string;
	tag?: string;

	/** Full snapshot if this is a keyframe commit, otherwise null. */
	snapshot: SerializedVersionSnapshot | null;
	/** Delta from parent if this is NOT a keyframe commit, otherwise null. */
	delta: JsonDelta | null;
	isKeyframe: boolean;
	/** The nearest keyframe ancestor (for delta reconstruction). */
	keyframeAncestorId: string | null;

	// Quick metadata for browsing
	thumbnailUrl?: string;
	duration: number;
	trackCount: number;
	elementCount: number;
	changeSummary: ChangeSummary;

	// Auto-commit marker
	isAutoCommit?: boolean;

	// Structured author info (populated from server for collaborative commits)
	authorInfo?: {
		id: string;
		name: string;
		avatar?: string;
	};
}

/** A JSON-serializable delta representing changes from one snapshot to another. */
export interface JsonDelta {
	operations: DeltaOperation[];
}

export type DeltaOperation =
	| { op: "add"; path: string; value: unknown }
	| { op: "remove"; path: string; oldValue: unknown }
	| { op: "replace"; path: string; oldValue: unknown; newValue: unknown };

// ─── Branches ────────────────────────────────────────────────────────────────

export interface Branch {
	id: string;
	projectId: string;
	name: string;
	headCommitId: string;
	description?: string;
	color?: string;
	createdAt: string; // ISO 8601
	createdFromBranch: string;
	createdFromCommitId: string;
	isTemplate?: boolean;
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export type TagType = "milestone" | "review" | "export" | "custom";

export interface Tag {
	id: string;
	commitId: string;
	name: string;
	type: TagType;
	note?: string;
	createdAt: string; // ISO 8601
	createdBy: string;
}

// ─── Stash ───────────────────────────────────────────────────────────────────

export interface Stash {
	id: string;
	branchId: string;
	snapshot: SerializedVersionSnapshot;
	message?: string;
	createdAt: string; // ISO 8601
}

// ─── Version Status ──────────────────────────────────────────────────────────

export interface VersionStatus {
	currentBranch: string;
	isDirty: boolean;
	lastCommitId: string | null;
	uncommittedChangesCount: number;
}

// ─── Diffing Types ───────────────────────────────────────────────────────────

export type ChangeCategory =
	| "structure"
	| "content"
	| "timing"
	| "visual"
	| "audio"
	| "text";

export interface PropertyChange {
	path: string;
	oldValue: unknown;
	newValue: unknown;
	category: ChangeCategory;
	humanReadable: string;
}

export interface ElementSummary {
	elementId: string;
	elementName: string;
	trackId: string;
	trackName: string;
	elementType: string;
}

export interface ElementModification {
	elementId: string;
	elementName: string;
	trackId: string;
	trackName: string;
	elementType: string;
	changes: PropertyChange[];
}

export interface ElementMove {
	elementId: string;
	elementName: string;
	fromTrackId: string;
	toTrackId: string;
}

export interface TrackSummary {
	trackId: string;
	trackName: string;
	trackType: string;
	elementCount: number;
}

export interface TrackReorder {
	trackId: string;
	trackName: string;
	oldIndex: number;
	newIndex: number;
}

export interface SceneSummary {
	sceneId: string;
	sceneName: string;
	trackCount: number;
}

export interface SceneModification {
	sceneId: string;
	sceneName: string;
	trackChanges: {
		added: TrackSummary[];
		removed: TrackSummary[];
		reordered: TrackReorder[];
	};
	elementChanges: {
		added: ElementSummary[];
		removed: ElementSummary[];
		modified: ElementModification[];
		moved: ElementMove[];
	};
}

export interface TimelineDiff {
	scenes: {
		added: SceneSummary[];
		removed: SceneSummary[];
		modified: SceneModification[];
	};
	totalChanges: number;
	changeSummary: ChangeSummary;
}

// ─── Merge Types (Phase 3 forward-declaration) ──────────────────────────────

export interface MergeConflict {
	id: string;
	elementId: string;
	elementName: string;
	property: string;
	sourceValue: unknown;
	targetValue: unknown;
	baseValue: unknown;
}

export type MergeResolution = "source" | "target" | "custom";

export interface MergeResult {
	merged: SerializedVersionSnapshot;
	conflicts: MergeConflict[];
	autoResolved: PropertyChange[];
}
