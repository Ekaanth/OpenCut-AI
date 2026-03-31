import type {
	MergeConflict,
	MergeResolution,
	MergeResult,
	SerializedVersionSnapshot,
	PropertyChange,
} from "@/types/version";

export type ConflictResolutionEntry = {
	conflictId: string;
	resolution: MergeResolution;
	customValue?: unknown;
};

/**
 * Manages the state of an in-progress merge, tracking pending and resolved conflicts.
 */
export class ConflictResolver {
	private mergeResult: MergeResult;
	private resolutions = new Map<string, ConflictResolutionEntry>();
	private preMergeSnapshot: SerializedVersionSnapshot | null = null;

	constructor(mergeResult: MergeResult, preMergeSnapshot?: SerializedVersionSnapshot) {
		this.mergeResult = mergeResult;
		this.preMergeSnapshot = preMergeSnapshot ?? null;
	}

	// ─── State Queries ────────────────────────────────────────────────────

	getConflicts(): MergeConflict[] {
		return this.mergeResult.conflicts;
	}

	getAutoResolved(): PropertyChange[] {
		return this.mergeResult.autoResolved;
	}

	getConflictCount(): number {
		return this.mergeResult.conflicts.length;
	}

	getResolvedCount(): number {
		return this.resolutions.size;
	}

	getUnresolvedCount(): number {
		return this.mergeResult.conflicts.length - this.resolutions.size;
	}

	isFullyResolved(): boolean {
		return this.resolutions.size >= this.mergeResult.conflicts.length;
	}

	getResolution(conflictId: string): ConflictResolutionEntry | undefined {
		return this.resolutions.get(conflictId);
	}

	// ─── Resolve Individual ───────────────────────────────────────────────

	resolveConflict(
		conflictId: string,
		resolution: MergeResolution,
		customValue?: unknown,
	): void {
		const conflict = this.mergeResult.conflicts.find((c) => c.id === conflictId);
		if (!conflict) throw new Error(`Conflict "${conflictId}" not found`);

		this.resolutions.set(conflictId, { conflictId, resolution, customValue });
	}

	unresolveConflict(conflictId: string): void {
		this.resolutions.delete(conflictId);
	}

	// ─── Batch Resolution ─────────────────────────────────────────────────

	acceptAllSource(): void {
		for (const conflict of this.mergeResult.conflicts) {
			this.resolutions.set(conflict.id, {
				conflictId: conflict.id,
				resolution: "source",
			});
		}
	}

	acceptAllTarget(): void {
		for (const conflict of this.mergeResult.conflicts) {
			this.resolutions.set(conflict.id, {
				conflictId: conflict.id,
				resolution: "target",
			});
		}
	}

	// ─── Apply Resolutions ────────────────────────────────────────────────

	/**
	 * Apply all resolutions to the merged snapshot and return the final state.
	 * Throws if any conflicts remain unresolved.
	 */
	applyResolutions(): SerializedVersionSnapshot {
		if (!this.isFullyResolved()) {
			throw new Error(
				`Cannot finalize merge: ${this.getUnresolvedCount()} unresolved conflict(s)`,
			);
		}

		const result = structuredClone(this.mergeResult.merged);

		for (const conflict of this.mergeResult.conflicts) {
			const entry = this.resolutions.get(conflict.id);
			if (!entry) continue;

			let resolvedValue: unknown;
			switch (entry.resolution) {
				case "source":
					resolvedValue = conflict.sourceValue;
					break;
				case "target":
					resolvedValue = conflict.targetValue;
					break;
				case "custom":
					resolvedValue = entry.customValue;
					break;
			}

			// Handle structural conflicts
			if (conflict.property === "__track_deleted__") {
				if (entry.resolution === "source") {
					// Source deleted it — remove from merged
					removeTrackFromSnapshot(result, conflict.elementId);
				}
				// target = keep it (already in merged)
				continue;
			}

			if (conflict.property === "__element_deleted__") {
				if (entry.resolution === "source") {
					// Source deleted it — remove from merged
					removeElementFromSnapshot(result, conflict.elementId);
				}
				// target = keep it (already in merged)
				continue;
			}

			if (conflict.elementId === "__settings__") {
				// Settings conflict
				const prop = conflict.property.replace("settings.", "");
				(result.settings as unknown as Record<string, unknown>)[prop] = structuredClone(resolvedValue);
				continue;
			}

			// Regular property conflict on an element
			applyPropertyToElement(result, conflict.elementId, conflict.property, resolvedValue);
		}

		return result;
	}

	// ─── Abort ────────────────────────────────────────────────────────────

	/**
	 * Returns the pre-merge snapshot to restore original state.
	 */
	abort(): SerializedVersionSnapshot | null {
		return this.preMergeSnapshot;
	}
}

// ─── Snapshot Mutation Helpers ─────────────────────────────────────────────

function removeTrackFromSnapshot(snapshot: SerializedVersionSnapshot, trackId: string): void {
	for (const scene of snapshot.scenes) {
		scene.tracks = scene.tracks.filter((t) => t.id !== trackId);
	}
}

function removeElementFromSnapshot(snapshot: SerializedVersionSnapshot, elemId: string): void {
	for (const scene of snapshot.scenes) {
		for (const track of scene.tracks) {
			const elems = (track as unknown as { elements: Array<Record<string, unknown>> }).elements;
			const idx = elems.findIndex((e) => e.id === elemId);
			if (idx !== -1) {
				elems.splice(idx, 1);
				return;
			}
		}
	}
}

function applyPropertyToElement(
	snapshot: SerializedVersionSnapshot,
	elemId: string,
	prop: string,
	value: unknown,
): void {
	for (const scene of snapshot.scenes) {
		for (const track of scene.tracks) {
			const elems = (track as unknown as { elements: Array<Record<string, unknown>> }).elements;
			const elem = elems.find((e) => e.id === elemId);
			if (elem) {
				elem[prop] = structuredClone(value);
				return;
			}
		}
	}
}
