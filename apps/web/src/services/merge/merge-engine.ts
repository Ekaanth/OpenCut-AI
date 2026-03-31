import type {
	SerializedVersionSnapshot,
	MergeResult,
	MergeConflict,
	PropertyChange,
	Commit,
} from "@/types/version";
import type { VersionStorage } from "@/services/storage/version-storage";
import { categorizeChange, describeChange, valuesDiffer } from "@/services/diff/change-descriptions";
import { generateUUID } from "@/utils/id";

// ─── Common Ancestor Detection (P3-01) ────────────────────────────────────

/**
 * Find the most recent common ancestor of two commits.
 * Walks both parent chains and returns the first intersection.
 */
export async function findCommonAncestor(
	storage: VersionStorage,
	commitIdA: string,
	commitIdB: string,
): Promise<string | null> {
	// Collect all ancestors of A
	const ancestorsA = new Set<string>();
	let currentA: string | null = commitIdA;
	while (currentA) {
		ancestorsA.add(currentA);
		const commit = await storage.getCommit(currentA);
		if (!commit) break;
		currentA = commit.parentId;
		// Also check merge parent
		if ((commit as MergeCommit).mergeParentId) {
			ancestorsA.add((commit as MergeCommit).mergeParentId!);
		}
	}

	// Walk B's chain, find first intersection with A's ancestors
	let currentB: string | null = commitIdB;
	while (currentB) {
		if (ancestorsA.has(currentB)) {
			return currentB;
		}
		const commit = await storage.getCommit(currentB);
		if (!commit) break;
		currentB = commit.parentId;
	}

	return null;
}

/** Extension of Commit that may have a merge parent. */
interface MergeCommit extends Commit {
	mergeParentId?: string;
	mergeSourceBranch?: string;
}

// ─── Three-Way Merge (P3-02) ──────────────────────────────────────────────

/**
 * Perform a three-way merge between source and target branches.
 *
 * 1. Find common ancestor (base)
 * 2. Compute diffBase→Source and diffBase→Target
 * 3. Apply non-conflicting changes from both
 * 4. Detect conflicts where both changed the same property differently
 */
export async function mergeBranches(
	storage: VersionStorage,
	sourceBranchName: string,
	targetBranchName: string,
): Promise<MergeResult> {
	const sourceBranch = await storage.getBranchByName(sourceBranchName);
	const targetBranch = await storage.getBranchByName(targetBranchName);

	if (!sourceBranch) throw new Error(`Branch "${sourceBranchName}" not found`);
	if (!targetBranch) throw new Error(`Branch "${targetBranchName}" not found`);

	const sourceSnapshot = await storage.reconstructSnapshot(sourceBranch.headCommitId);
	const targetSnapshot = await storage.reconstructSnapshot(targetBranch.headCommitId);

	if (!sourceSnapshot || !targetSnapshot) {
		throw new Error("Failed to reconstruct branch snapshots");
	}

	// Find common ancestor
	const baseCommitId = await findCommonAncestor(
		storage,
		sourceBranch.headCommitId,
		targetBranch.headCommitId,
	);

	if (!baseCommitId) {
		throw new Error("No common ancestor found — branches have diverged from different roots");
	}

	const baseSnapshot = await storage.reconstructSnapshot(baseCommitId);
	if (!baseSnapshot) {
		throw new Error("Failed to reconstruct base snapshot");
	}

	return threeWayMerge(baseSnapshot, sourceSnapshot, targetSnapshot);
}

/**
 * Core three-way merge algorithm.
 * Takes base, source, and target snapshots and produces a merged result.
 */
export function threeWayMerge(
	base: SerializedVersionSnapshot,
	source: SerializedVersionSnapshot,
	target: SerializedVersionSnapshot,
): MergeResult {
	const conflicts: MergeConflict[] = [];
	const autoResolved: PropertyChange[] = [];

	// Start with target as the base for the merged result
	const merged = structuredClone(target);

	// Build element maps for all three snapshots
	const baseElements = buildElementMap(base);
	const sourceElements = buildElementMap(source);
	const targetElements = buildElementMap(target);

	// Build track maps
	const baseTracks = buildTrackMap(base);
	const sourceTracks = buildTrackMap(source);
	const targetTracks = buildTrackMap(target);

	// ── Merge tracks ──────────────────────────────────────────────────────

	// Tracks added in source but not in target → add to merged
	for (const [trackId, sourceTrack] of sourceTracks) {
		if (!baseTracks.has(trackId) && !targetTracks.has(trackId)) {
			// New track in source — add it to the first scene of merged
			if (merged.scenes.length > 0) {
				merged.scenes[0].tracks.push(structuredClone(sourceTrack) as unknown as typeof merged.scenes[0]["tracks"][number]);
				autoResolved.push({
					path: `tracks.${trackId}`,
					oldValue: undefined,
					newValue: sourceTrack.name as string,
					category: "structure",
					humanReadable: `Added track "${sourceTrack.name as string as string}" from source`,
				});
			}
		}
	}

	// Tracks deleted in source but still in target → conflict if target modified
	for (const [trackId, baseTrack] of baseTracks) {
		const inSource = sourceTracks.has(trackId);
		const inTarget = targetTracks.has(trackId);

		if (!inSource && inTarget) {
			// Source deleted this track — check if target modified it
			const targetTrack = targetTracks.get(trackId)!;
			if (JSON.stringify(baseTrack) !== JSON.stringify(targetTrack)) {
				conflicts.push({
					id: generateUUID(),
					elementId: trackId,
					elementName: baseTrack.name as string,
					property: "__track_deleted__",
					sourceValue: null,
					targetValue: targetTrack,
					baseValue: baseTrack,
				});
			} else {
				// Target didn't modify — safe to delete
				removeTrackFromMerged(merged, trackId);
				autoResolved.push({
					path: `tracks.${trackId}`,
					oldValue: baseTrack.name as string,
					newValue: undefined,
					category: "structure",
					humanReadable: `Removed track "${baseTrack.name as string}"`,
				});
			}
		}
	}

	// ── Merge elements ────────────────────────────────────────────────────

	// Elements added in source → add to merged
	for (const [elemId, sourceElem] of sourceElements) {
		if (!baseElements.has(elemId) && !targetElements.has(elemId)) {
			addElementToMerged(merged, sourceElem.element, sourceElem.trackId);
			autoResolved.push({
				path: `elements.${elemId}`,
				oldValue: undefined,
				newValue: sourceElem.element.name as string,
				category: "content",
				humanReadable: `Added element "${sourceElem.element.name as string}" from source`,
			});
		}
	}

	// Elements deleted in source, still in target
	for (const [elemId, baseElem] of baseElements) {
		const inSource = sourceElements.has(elemId);
		const inTarget = targetElements.has(elemId);

		if (!inSource && inTarget) {
			const targetElem = targetElements.get(elemId)!;
			if (JSON.stringify(baseElem.element) !== JSON.stringify(targetElem.element)) {
				// Target modified, source deleted → conflict
				conflicts.push({
					id: generateUUID(),
					elementId: elemId,
					elementName: baseElem.element.name as string,
					property: "__element_deleted__",
					sourceValue: null,
					targetValue: targetElem.element,
					baseValue: baseElem.element,
				});
			} else {
				removeElementFromMerged(merged, elemId);
				autoResolved.push({
					path: `elements.${elemId}`,
					oldValue: baseElem.element.name as string,
					newValue: undefined,
					category: "content",
					humanReadable: `Removed element "${baseElem.element.name as string}"`,
				});
			}
		}
	}

	// Elements modified in both branches — property-level merge
	for (const [elemId, baseElem] of baseElements) {
		const sourceElem = sourceElements.get(elemId);
		const targetElem = targetElements.get(elemId);

		if (!sourceElem || !targetElem) continue; // handled above

		const baseObj = baseElem.element as unknown as Record<string, unknown>;
		const sourceObj = sourceElem.element as unknown as Record<string, unknown>;
		const targetObj = targetElem.element as unknown as Record<string, unknown>;

		const allProps = new Set([
			...Object.keys(baseObj),
			...Object.keys(sourceObj),
			...Object.keys(targetObj),
		]);

		for (const prop of allProps) {
			if (prop === "id" || prop === "createdAt" || prop === "updatedAt" || prop === "buffer") continue;

			const baseVal = baseObj[prop];
			const sourceVal = sourceObj[prop];
			const targetVal = targetObj[prop];

			const sourceChanged = valuesDiffer(baseVal, sourceVal);
			const targetChanged = valuesDiffer(baseVal, targetVal);

			if (sourceChanged && !targetChanged) {
				// Only source changed — apply source value to merged
				applyPropertyToMergedElement(merged, elemId, prop, sourceVal);
				autoResolved.push({
					path: `${elemId}.${prop}`,
					oldValue: baseVal,
					newValue: sourceVal,
					category: categorizeChange(prop),
					humanReadable: describeChange(prop, baseVal, sourceVal),
				});
			} else if (!sourceChanged && targetChanged) {
				// Only target changed — already in merged, nothing to do
			} else if (sourceChanged && targetChanged) {
				if (!valuesDiffer(sourceVal, targetVal)) {
					// Both changed to the same value — no conflict
				} else {
					// Both changed to different values → conflict
					conflicts.push({
						id: generateUUID(),
						elementId: elemId,
						elementName: baseElem.element.name as string ?? elemId,
						property: prop,
						sourceValue: sourceVal,
						targetValue: targetVal,
						baseValue: baseVal,
					});
				}
			}
		}
	}

	// ── Merge settings ────────────────────────────────────────────────────

	const settingsBase = base.settings as unknown as Record<string, unknown>;
	const settingsSource = source.settings as unknown as Record<string, unknown>;
	const settingsTarget = target.settings as unknown as Record<string, unknown>;

	for (const prop of Object.keys(settingsBase)) {
		const bv = settingsBase[prop];
		const sv = settingsSource[prop];
		const tv = settingsTarget[prop];

		const sourceChanged = valuesDiffer(bv, sv);
		const targetChanged = valuesDiffer(bv, tv);

		if (sourceChanged && !targetChanged) {
			(merged.settings as unknown as Record<string, unknown>)[prop] = structuredClone(sv);
			autoResolved.push({
				path: `settings.${prop}`,
				oldValue: bv,
				newValue: sv,
				category: "visual",
				humanReadable: describeChange(`settings.${prop}`, bv, sv),
			});
		} else if (sourceChanged && targetChanged && valuesDiffer(sv, tv)) {
			conflicts.push({
				id: generateUUID(),
				elementId: "__settings__",
				elementName: "Project Settings",
				property: `settings.${prop}`,
				sourceValue: sv,
				targetValue: tv,
				baseValue: bv,
			});
		}
	}

	return { merged, conflicts, autoResolved };
}

// ─── Cherry-Pick (P3-06) ──────────────────────────────────────────────────

export interface CherryPickResult {
	applied: PropertyChange[];
	conflicts: MergeConflict[];
}

/**
 * Cherry-pick: apply a single commit's changes to the current snapshot.
 * Computes the diff of the commit vs its parent, then applies those changes.
 */
export async function cherryPick(
	storage: VersionStorage,
	commitId: string,
	currentSnapshot: SerializedVersionSnapshot,
): Promise<CherryPickResult> {
	const commit = await storage.getCommit(commitId);
	if (!commit) throw new Error("Commit not found");

	const commitSnapshot = await storage.reconstructSnapshot(commitId);
	if (!commitSnapshot) throw new Error("Failed to reconstruct commit snapshot");

	// Get the parent snapshot (base for the cherry-picked commit)
	let parentSnapshot: SerializedVersionSnapshot | null = null;
	if (commit.parentId) {
		parentSnapshot = await storage.reconstructSnapshot(commit.parentId);
	}

	if (!parentSnapshot) {
		// First commit — treat as applying all its content
		parentSnapshot = { scenes: [], settings: commitSnapshot.settings, currentSceneId: "" };
	}

	// The changes introduced by this commit = diff(parent → commit)
	// Apply those same changes to currentSnapshot
	const result = threeWayMerge(parentSnapshot, commitSnapshot, currentSnapshot);

	return {
		applied: result.autoResolved,
		conflicts: result.conflicts,
	};
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ElementInfo {
	element: Record<string, unknown>;
	trackId: string;
	sceneIdx: number;
	trackIdx: number;
}

function buildElementMap(snapshot: SerializedVersionSnapshot): Map<string, ElementInfo> {
	const map = new Map<string, ElementInfo>();
	for (let si = 0; si < snapshot.scenes.length; si++) {
		const scene = snapshot.scenes[si];
		for (let ti = 0; ti < scene.tracks.length; ti++) {
			const track = scene.tracks[ti] as unknown as { id: string; elements: Array<Record<string, unknown>> };
			for (const elem of track.elements) {
				if (elem.id) {
					map.set(elem.id as string, {
						element: elem,
						trackId: track.id,
						sceneIdx: si,
						trackIdx: ti,
					});
				}
			}
		}
	}
	return map;
}

function buildTrackMap(snapshot: SerializedVersionSnapshot): Map<string, Record<string, unknown>> {
	const map = new Map<string, Record<string, unknown>>();
	for (const scene of snapshot.scenes) {
		for (const track of scene.tracks) {
			map.set(track.id, track as unknown as unknown as Record<string, unknown>);
		}
	}
	return map;
}

function removeTrackFromMerged(merged: SerializedVersionSnapshot, trackId: string): void {
	for (const scene of merged.scenes) {
		scene.tracks = scene.tracks.filter((t) => t.id !== trackId);
	}
}

function removeElementFromMerged(merged: SerializedVersionSnapshot, elemId: string): void {
	for (const scene of merged.scenes) {
		for (const track of scene.tracks) {
			const elements = (track as unknown as { elements: Array<Record<string, unknown>> }).elements;
			const idx = elements.findIndex((e) => e.id === elemId);
			if (idx !== -1) {
				elements.splice(idx, 1);
				return;
			}
		}
	}
}

function addElementToMerged(
	merged: SerializedVersionSnapshot,
	element: Record<string, unknown>,
	preferredTrackId: string,
): void {
	for (const scene of merged.scenes) {
		for (const track of scene.tracks) {
			if (track.id === preferredTrackId) {
				(track as unknown as { elements: Array<Record<string, unknown>> }).elements.push(
					structuredClone(element),
				);
				return;
			}
		}
	}
	// Track not found — add to first track of first scene
	if (merged.scenes.length > 0 && merged.scenes[0].tracks.length > 0) {
		(merged.scenes[0].tracks[0] as unknown as { elements: Array<Record<string, unknown>> }).elements.push(
			structuredClone(element),
		);
	}
}

function applyPropertyToMergedElement(
	merged: SerializedVersionSnapshot,
	elemId: string,
	prop: string,
	value: unknown,
): void {
	for (const scene of merged.scenes) {
		for (const track of scene.tracks) {
			const elements = (track as unknown as { elements: Array<Record<string, unknown>> }).elements;
			const elem = elements.find((e) => e.id === elemId);
			if (elem) {
				elem[prop] = structuredClone(value);
				return;
			}
		}
	}
}

