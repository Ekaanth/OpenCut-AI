import type {
	Commit,
	Branch,
	Tag,
	Stash,
	SerializedVersionSnapshot,
	JsonDelta,
	DeltaOperation,
} from "@/types/version";

const DB_VERSION = 2;
const KEYFRAME_INTERVAL = 20;

/**
 * IndexedDB storage adapter for version control data.
 * Each project gets its own database: "video-editor-versions-{projectId}"
 */
export class VersionStorage {
	private dbName: string;

	constructor(projectId: string) {
		this.dbName = `video-editor-versions-${projectId}`;
	}

	// ─── Database ─────────────────────────────────────────────────────────────

	private async getDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				if (!db.objectStoreNames.contains("commits")) {
					const commitStore = db.createObjectStore("commits", {
						keyPath: "id",
					});
					commitStore.createIndex("by-project", "projectId");
					commitStore.createIndex("by-timestamp", "timestamp");
					commitStore.createIndex("by-parent", "parentId");
				}

				if (!db.objectStoreNames.contains("branches")) {
					const branchStore = db.createObjectStore("branches", {
						keyPath: "id",
					});
					branchStore.createIndex("by-name", "name", { unique: true });
				}

				if (!db.objectStoreNames.contains("tags")) {
					const tagStore = db.createObjectStore("tags", {
						keyPath: "id",
					});
					tagStore.createIndex("by-name", "name", { unique: true });
					tagStore.createIndex("by-commit", "commitId");
				}

				if (!db.objectStoreNames.contains("meta")) {
					db.createObjectStore("meta", { keyPath: "key" });
				}

				if (!db.objectStoreNames.contains("stashes")) {
					const stashStore = db.createObjectStore("stashes", {
						keyPath: "id",
					});
					stashStore.createIndex("by-branch", "branchId");
				}
			};
		});
	}

	// ─── Commits ──────────────────────────────────────────────────────────────

	async saveCommit(commit: Commit): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("commits", "readwrite");
		const store = tx.objectStore("commits");
		return new Promise((resolve, reject) => {
			const request = store.put(commit);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getCommit(commitId: string): Promise<Commit | null> {
		const db = await this.getDB();
		const tx = db.transaction("commits", "readonly");
		const store = tx.objectStore("commits");
		return new Promise((resolve, reject) => {
			const request = store.get(commitId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? null);
		});
	}

	async getAllCommits(): Promise<Commit[]> {
		const db = await this.getDB();
		const tx = db.transaction("commits", "readonly");
		const store = tx.objectStore("commits");
		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? []);
		});
	}

	/**
	 * Walk the parent chain from a given commit to build a log.
	 * Returns commits in reverse chronological order (newest first).
	 */
	async getCommitChain(commitId: string, limit = 50): Promise<Commit[]> {
		const chain: Commit[] = [];
		let currentId: string | null = commitId;

		while (currentId && chain.length < limit) {
			const commit = await this.getCommit(currentId);
			if (!commit) break;
			chain.push(commit);
			currentId = commit.parentId;
		}

		return chain;
	}

	/**
	 * Get the commit count from root to the given commit.
	 * Used to determine if a new commit should be a keyframe.
	 */
	async getCommitDepth(commitId: string): Promise<number> {
		let depth = 0;
		let currentId: string | null = commitId;

		while (currentId) {
			const commit = await this.getCommit(currentId);
			if (!commit) break;
			if (commit.isKeyframe) return depth;
			depth++;
			currentId = commit.parentId;
		}

		return depth;
	}

	/**
	 * Determine if the next commit should be a keyframe based on distance
	 * from the last keyframe ancestor.
	 */
	async shouldBeKeyframe(parentCommitId: string | null): Promise<boolean> {
		if (!parentCommitId) return true; // First commit is always a keyframe
		const depth = await this.getCommitDepth(parentCommitId);
		return depth >= KEYFRAME_INTERVAL - 1;
	}

	/**
	 * Reconstruct a full snapshot from a commit by finding its nearest
	 * keyframe ancestor and applying deltas forward.
	 */
	async reconstructSnapshot(
		commitId: string,
	): Promise<SerializedVersionSnapshot | null> {
		const commit = await this.getCommit(commitId);
		if (!commit) return null;

		// If this commit has a full snapshot, return it directly
		if (commit.isKeyframe && commit.snapshot) {
			return commit.snapshot;
		}

		// Walk back to find the keyframe ancestor, collecting deltas
		const deltaChain: JsonDelta[] = [];
		let current: Commit | null = commit;

		while (current && !current.isKeyframe) {
			if (current.delta) {
				deltaChain.unshift(current.delta); // prepend so we apply in order
			}
			current = current.parentId
				? await this.getCommit(current.parentId)
				: null;
		}

		if (!current?.snapshot) {
			console.error("Failed to find keyframe ancestor for commit", commitId);
			return null;
		}

		// Apply deltas forward from keyframe
		let snapshot = structuredClone(current.snapshot);
		for (const delta of deltaChain) {
			snapshot = applyDelta(snapshot, delta);
		}

		return snapshot;
	}

	// ─── Branches ─────────────────────────────────────────────────────────────

	async saveBranch(branch: Branch): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("branches", "readwrite");
		const store = tx.objectStore("branches");
		return new Promise((resolve, reject) => {
			const request = store.put(branch);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getBranch(branchId: string): Promise<Branch | null> {
		const db = await this.getDB();
		const tx = db.transaction("branches", "readonly");
		const store = tx.objectStore("branches");
		return new Promise((resolve, reject) => {
			const request = store.get(branchId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? null);
		});
	}

	async getBranchByName(name: string): Promise<Branch | null> {
		const db = await this.getDB();
		const tx = db.transaction("branches", "readonly");
		const store = tx.objectStore("branches");
		const index = store.index("by-name");
		return new Promise((resolve, reject) => {
			const request = index.get(name);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? null);
		});
	}

	async getAllBranches(): Promise<Branch[]> {
		const db = await this.getDB();
		const tx = db.transaction("branches", "readonly");
		const store = tx.objectStore("branches");
		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? []);
		});
	}

	async deleteBranch(branchId: string): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("branches", "readwrite");
		const store = tx.objectStore("branches");
		return new Promise((resolve, reject) => {
			const request = store.delete(branchId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// ─── Tags ─────────────────────────────────────────────────────────────────

	async saveTag(tag: Tag): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("tags", "readwrite");
		const store = tx.objectStore("tags");
		return new Promise((resolve, reject) => {
			const request = store.put(tag);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getTagByName(name: string): Promise<Tag | null> {
		const db = await this.getDB();
		const tx = db.transaction("tags", "readonly");
		const store = tx.objectStore("tags");
		const index = store.index("by-name");
		return new Promise((resolve, reject) => {
			const request = index.get(name);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? null);
		});
	}

	async getTagsForCommit(commitId: string): Promise<Tag[]> {
		const db = await this.getDB();
		const tx = db.transaction("tags", "readonly");
		const store = tx.objectStore("tags");
		const index = store.index("by-commit");
		return new Promise((resolve, reject) => {
			const request = index.getAll(commitId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? []);
		});
	}

	async getAllTags(): Promise<Tag[]> {
		const db = await this.getDB();
		const tx = db.transaction("tags", "readonly");
		const store = tx.objectStore("tags");
		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result ?? []);
		});
	}

	async deleteTag(name: string): Promise<void> {
		const tag = await this.getTagByName(name);
		if (!tag) return;
		const db = await this.getDB();
		const tx = db.transaction("tags", "readwrite");
		const store = tx.objectStore("tags");
		return new Promise((resolve, reject) => {
			const request = store.delete(tag.id);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// ─── Stashes ──────────────────────────────────────────────────────────────

	async saveStash(stash: Stash): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("stashes", "readwrite");
		const store = tx.objectStore("stashes");
		return new Promise((resolve, reject) => {
			const request = store.put(stash);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getAllStashes(): Promise<Stash[]> {
		const db = await this.getDB();
		const tx = db.transaction("stashes", "readonly");
		const store = tx.objectStore("stashes");
		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const results = (request.result ?? []) as Stash[];
				// Sort newest first
				results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				resolve(results);
			};
		});
	}

	async deleteStash(stashId: string): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("stashes", "readwrite");
		const store = tx.objectStore("stashes");
		return new Promise((resolve, reject) => {
			const request = store.delete(stashId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// ─── Meta (current branch, etc.) ──────────────────────────────────────────

	async getMeta(key: string): Promise<string | null> {
		const db = await this.getDB();
		const tx = db.transaction("meta", "readonly");
		const store = tx.objectStore("meta");
		return new Promise((resolve, reject) => {
			const request = store.get(key);
			request.onerror = () => reject(request.error);
			request.onsuccess = () =>
				resolve(request.result ? request.result.value : null);
		});
	}

	async setMeta(key: string, value: string): Promise<void> {
		const db = await this.getDB();
		const tx = db.transaction("meta", "readwrite");
		const store = tx.objectStore("meta");
		return new Promise((resolve, reject) => {
			const request = store.put({ key, value });
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	// ─── Cleanup ──────────────────────────────────────────────────────────────

	async deleteDatabase(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(this.dbName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
}

// ─── Delta Utilities ───────────────────────────────────────────────────────

/**
 * Compute a JSON delta between two serialized snapshots.
 * Produces a list of add/remove/replace operations.
 */
export function computeDelta(
	oldSnapshot: SerializedVersionSnapshot,
	newSnapshot: SerializedVersionSnapshot,
): JsonDelta {
	const operations: DeltaOperation[] = [];
	diffObjects(oldSnapshot, newSnapshot, "", operations);
	return { operations };
}

/**
 * Apply a delta to a snapshot to produce the next state.
 */
export function applyDelta(
	snapshot: SerializedVersionSnapshot,
	delta: JsonDelta,
): SerializedVersionSnapshot {
	const result = structuredClone(snapshot) as unknown as Record<string, unknown>;

	for (const op of delta.operations) {
		const { parent, key } = parsePath(op.path);
		const target = navigateTo(result, parent);
		if (!target) continue;

		if (op.op === "add" || op.op === "replace") {
			if (Array.isArray(target)) {
				const idx = parseInt(key, 10);
				if (op.op === "add") {
					target.splice(idx, 0, structuredClone(op.value));
				} else {
					target[idx] = structuredClone(op.newValue);
				}
			} else {
				(target as Record<string, unknown>)[key] = structuredClone(
					op.op === "add" ? op.value : op.newValue,
				);
			}
		} else if (op.op === "remove") {
			if (Array.isArray(target)) {
				target.splice(parseInt(key, 10), 1);
			} else {
				delete (target as Record<string, unknown>)[key];
			}
		}
	}

	return result as unknown as SerializedVersionSnapshot;
}

function diffObjects(
	a: unknown,
	b: unknown,
	path: string,
	ops: DeltaOperation[],
): void {
	if (a === b) return;
	if (a === null || b === null || typeof a !== typeof b) {
		ops.push({ op: "replace", path, oldValue: a, newValue: b });
		return;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		diffArrays(a, b, path, ops);
		return;
	}

	if (typeof a === "object" && typeof b === "object") {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

		for (const key of allKeys) {
			const subPath = path ? `${path}.${key}` : key;
			if (!(key in aObj)) {
				ops.push({ op: "add", path: subPath, value: bObj[key] });
			} else if (!(key in bObj)) {
				ops.push({ op: "remove", path: subPath, oldValue: aObj[key] });
			} else {
				diffObjects(aObj[key], bObj[key], subPath, ops);
			}
		}
		return;
	}

	// Primitive values that differ
	if (a !== b) {
		ops.push({ op: "replace", path, oldValue: a, newValue: b });
	}
}

function diffArrays(
	a: unknown[],
	b: unknown[],
	path: string,
	ops: DeltaOperation[],
): void {
	// For arrays with `id` fields (scenes, tracks, elements), use ID-based diffing
	const aHasIds =
		a.length > 0 && typeof a[0] === "object" && a[0] !== null && "id" in a[0];
	const bHasIds =
		b.length > 0 && typeof b[0] === "object" && b[0] !== null && "id" in b[0];

	if (aHasIds || bHasIds) {
		diffArrayById(a, b, path, ops);
	} else {
		// Simple index-based diff for non-ID arrays
		const maxLen = Math.max(a.length, b.length);
		for (let i = 0; i < maxLen; i++) {
			const subPath = `${path}[${i}]`;
			if (i >= a.length) {
				ops.push({ op: "add", path: subPath, value: b[i] });
			} else if (i >= b.length) {
				ops.push({ op: "remove", path: subPath, oldValue: a[i] });
			} else {
				diffObjects(a[i], b[i], subPath, ops);
			}
		}
	}
}

function diffArrayById(
	a: unknown[],
	b: unknown[],
	path: string,
	ops: DeltaOperation[],
): void {
	const aMap = new Map<string, { item: unknown; index: number }>();
	const bMap = new Map<string, { item: unknown; index: number }>();

	for (let i = 0; i < a.length; i++) {
		const item = a[i] as Record<string, unknown>;
		if (item?.id) aMap.set(item.id as string, { item, index: i });
	}
	for (let i = 0; i < b.length; i++) {
		const item = b[i] as Record<string, unknown>;
		if (item?.id) bMap.set(item.id as string, { item, index: i });
	}

	// Removed items (in a but not in b)
	for (const [id, { index }] of aMap) {
		if (!bMap.has(id)) {
			ops.push({ op: "remove", path: `${path}[${index}]`, oldValue: aMap.get(id)!.item });
		}
	}

	// Added items (in b but not in a)
	for (const [id, { item, index }] of bMap) {
		if (!aMap.has(id)) {
			ops.push({ op: "add", path: `${path}[${index}]`, value: item });
		}
	}

	// Modified items (in both)
	for (const [id] of aMap) {
		if (bMap.has(id)) {
			const aItem = aMap.get(id)!;
			const bItem = bMap.get(id)!;
			diffObjects(aItem.item, bItem.item, `${path}[${aItem.index}]`, ops);
		}
	}
}

function parsePath(path: string): { parent: string; key: string } {
	// Handle array index paths like "scenes[0].tracks[1]"
	const bracketMatch = path.match(/^(.+)\[(\d+)\]$/);
	if (bracketMatch) {
		return { parent: bracketMatch[1], key: bracketMatch[2] };
	}

	const lastDot = path.lastIndexOf(".");
	if (lastDot === -1) return { parent: "", key: path };
	return { parent: path.substring(0, lastDot), key: path.substring(lastDot + 1) };
}

function navigateTo(
	obj: Record<string, unknown>,
	path: string,
): unknown {
	if (!path) return obj;

	const segments = tokenizePath(path);
	let current: unknown = obj;

	for (const segment of segments) {
		if (current === null || current === undefined) return null;
		if (typeof segment === "number" && Array.isArray(current)) {
			current = current[segment];
		} else if (typeof current === "object") {
			current = (current as Record<string, unknown>)[segment as string];
		} else {
			return null;
		}
	}

	return current;
}

function tokenizePath(path: string): (string | number)[] {
	const tokens: (string | number)[] = [];
	const regex = /([^.[]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(path))) {
		if (match[1]) tokens.push(match[1]);
		else if (match[2]) tokens.push(parseInt(match[2], 10));
	}
	return tokens;
}
