import type { Commit, PropertyChange, SerializedVersionSnapshot } from "@/types/version";
import type { VersionStorage } from "@/services/storage/version-storage";
import { categorizeChange, describeChange, valuesDiffer } from "@/services/diff/change-descriptions";

export interface BlameEntry {
	commitId: string;
	commitMessage: string;
	timestamp: string;
	author: string;
	authorInfo?: { id: string; name: string; avatar?: string };
	changes: PropertyChange[];
}

/**
 * Get the full change history of a specific element across all commits.
 * Returns a list of commits that modified this element, with property-level details.
 */
export async function blameElement(
	storage: VersionStorage,
	elementId: string,
	headCommitId: string,
	limit = 100,
): Promise<BlameEntry[]> {
	const entries: BlameEntry[] = [];
	const chain = await storage.getCommitChain(headCommitId, limit);

	for (let i = 0; i < chain.length - 1; i++) {
		const commit = chain[i];
		const parentCommit = chain[i + 1];

		const snapshot = await storage.reconstructSnapshot(commit.id);
		const parentSnapshot = await storage.reconstructSnapshot(parentCommit.id);

		if (!snapshot || !parentSnapshot) continue;

		const currentElem = findElementInSnapshot(snapshot, elementId);
		const parentElem = findElementInSnapshot(parentSnapshot, elementId);

		if (!currentElem && !parentElem) continue;

		const changes: PropertyChange[] = [];

		if (!parentElem && currentElem) {
			// Element was added in this commit
			changes.push({
				path: "element",
				oldValue: undefined,
				newValue: "added",
				category: "content",
				humanReadable: `Element "${(currentElem as Record<string, unknown>).name}" was added`,
			});
		} else if (parentElem && !currentElem) {
			// Element was removed in this commit
			changes.push({
				path: "element",
				oldValue: "existed",
				newValue: undefined,
				category: "content",
				humanReadable: `Element "${(parentElem as Record<string, unknown>).name}" was removed`,
			});
		} else if (parentElem && currentElem) {
			// Element exists in both — find property-level changes
			const pObj = parentElem as Record<string, unknown>;
			const cObj = currentElem as Record<string, unknown>;
			const allKeys = new Set([...Object.keys(pObj), ...Object.keys(cObj)]);

			for (const key of allKeys) {
				if (key === "id" || key === "createdAt" || key === "updatedAt" || key === "buffer") continue;
				if (valuesDiffer(pObj[key], cObj[key])) {
					changes.push({
						path: key,
						oldValue: pObj[key],
						newValue: cObj[key],
						category: categorizeChange(key),
						humanReadable: describeChange(key, pObj[key], cObj[key]),
					});
				}
			}
		}

		if (changes.length > 0) {
			entries.push({
				commitId: commit.id,
				commitMessage: commit.message,
				timestamp: commit.timestamp,
				author: commit.author,
				authorInfo: commit.authorInfo,
				changes,
			});
		}
	}

	// Check if element was present in the earliest commit (first appearance)
	if (chain.length > 0) {
		const earliest = chain[chain.length - 1];
		const snapshot = await storage.reconstructSnapshot(earliest.id);
		if (snapshot) {
			const elem = findElementInSnapshot(snapshot, elementId);
			if (elem) {
				entries.push({
					commitId: earliest.id,
					commitMessage: earliest.message,
					timestamp: earliest.timestamp,
					author: earliest.author,
					authorInfo: earliest.authorInfo,
					changes: [{
						path: "element",
						oldValue: undefined,
						newValue: "created",
						category: "content",
						humanReadable: `Element "${(elem as Record<string, unknown>).name}" first appeared`,
					}],
				});
			}
		}
	}

	return entries;
}

function findElementInSnapshot(
	snapshot: SerializedVersionSnapshot,
	elementId: string,
): unknown | null {
	for (const scene of snapshot.scenes) {
		for (const track of scene.tracks) {
			const elements = (track as unknown as { elements: Array<Record<string, unknown>> }).elements;
			const found = elements.find((e) => e.id === elementId);
			if (found) return found;
		}
	}
	return null;
}
