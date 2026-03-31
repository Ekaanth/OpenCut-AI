import type { Commit, Branch, Tag } from "@/types/version";
import type { VersionStorage } from "@/services/storage/version-storage";

export type SyncStatus =
	| "idle"
	| "syncing"
	| "synced"
	| "unsynced"
	| "offline"
	| "error";

export interface SyncState {
	status: SyncStatus;
	lastSyncAt: string | null;
	commitsAhead: number;
	commitsBehind: number;
	error: string | null;
}

/**
 * Client-server sync engine.
 * Keeps local IndexedDB and server PostgreSQL in sync.
 * Offline-first: all operations work locally, sync is async.
 */
export class SyncEngine {
	private repoId: string | null = null;
	private apiBase = "/api/version-control";
	private storage: VersionStorage;
	private state: SyncState = {
		status: "idle",
		lastSyncAt: null,
		commitsAhead: 0,
		commitsBehind: 0,
		error: null,
	};
	private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
	private listeners = new Set<(state: SyncState) => void>();

	constructor(storage: VersionStorage) {
		this.storage = storage;
	}

	// ─── Initialization ───────────────────────────────────────────────────

	/**
	 * Set up sync for a server-side repository.
	 */
	setRepoId(repoId: string): void {
		this.repoId = repoId;
	}

	getRepoId(): string | null {
		return this.repoId;
	}

	/**
	 * Create a server-side repo for a project (first-time sync setup).
	 */
	async createRemoteRepo(projectId: string, name: string): Promise<string> {
		const response = await fetch(`${this.apiBase}/repos`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ projectId, name }),
		});

		if (!response.ok) {
			throw new Error(`Failed to create repo: ${response.statusText}`);
		}

		const repo = await response.json();
		this.repoId = repo.id;
		return repo.id;
	}

	// ─── Push ─────────────────────────────────────────────────────────────

	/**
	 * Push local commits/branches/tags to the server.
	 */
	async push(): Promise<{ pushed: number }> {
		if (!this.repoId) throw new Error("No repo configured for sync");

		this.updateState({ status: "syncing", error: null });

		try {
			// Gather all local data
			const localCommits = await this.storage.getAllCommits();
			const localBranches = await this.storage.getAllBranches();
			const localTags = await this.storage.getAllTags();

			const response = await fetch(
				`${this.apiBase}/repos/${this.repoId}/sync`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						knownCommitIds: [],
						pushCommits: localCommits.map(commitToSyncFormat),
						pushBranches: localBranches,
						pushTags: localTags,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Push failed: ${response.statusText}`);
			}

			const result = await response.json();

			this.updateState({
				status: "synced",
				lastSyncAt: new Date().toISOString(),
				commitsAhead: 0,
			});

			return { pushed: result.pushed };
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Push failed";
			this.updateState({ status: "error", error: msg });
			throw error;
		}
	}

	// ─── Pull ─────────────────────────────────────────────────────────────

	/**
	 * Pull remote commits/branches/tags to local storage.
	 */
	async pull(): Promise<{ pulled: number }> {
		if (!this.repoId) throw new Error("No repo configured for sync");

		this.updateState({ status: "syncing", error: null });

		try {
			const localCommits = await this.storage.getAllCommits();
			const knownIds = localCommits.map((c) => c.id);

			const response = await fetch(
				`${this.apiBase}/repos/${this.repoId}/sync`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						knownCommitIds: knownIds,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Pull failed: ${response.statusText}`);
			}

			const result = await response.json();
			const { commits, branches, tags } = result.pull;

			// Store pulled commits locally
			let pulled = 0;
			for (const commit of commits) {
				const existing = await this.storage.getCommit(commit.id);
				if (!existing) {
					await this.storage.saveCommit(serverCommitToLocal(commit));
					pulled++;
				}
			}

			// Update branches
			for (const branch of branches) {
				await this.storage.saveBranch({
					id: branch.id,
					projectId: branch.repoId || "",
					name: branch.name,
					headCommitId: branch.headCommitId,
					description: branch.description,
					color: branch.color,
					createdAt: branch.createdAt,
					createdFromBranch: branch.createdFromBranch || "main",
					createdFromCommitId: branch.createdFromCommitId || "",
				});
			}

			// Update tags
			for (const tag of tags) {
				await this.storage.saveTag({
					id: tag.id,
					commitId: tag.commitId,
					name: tag.name,
					type: tag.type || "custom",
					note: tag.note,
					createdAt: tag.createdAt,
					createdBy: tag.createdBy || "remote",
				});
			}

			this.updateState({
				status: "synced",
				lastSyncAt: new Date().toISOString(),
				commitsBehind: 0,
			});

			return { pulled };
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Pull failed";
			this.updateState({ status: "error", error: msg });
			throw error;
		}
	}

	// ─── Full Sync ────────────────────────────────────────────────────────

	/**
	 * Push and pull in one operation.
	 */
	async sync(): Promise<{ pushed: number; pulled: number }> {
		if (!this.repoId) throw new Error("No repo configured for sync");

		this.updateState({ status: "syncing", error: null });

		try {
			const localCommits = await this.storage.getAllCommits();
			const localBranches = await this.storage.getAllBranches();
			const localTags = await this.storage.getAllTags();
			const knownIds = localCommits.map((c) => c.id);

			const response = await fetch(
				`${this.apiBase}/repos/${this.repoId}/sync`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						knownCommitIds: knownIds,
						pushCommits: localCommits.map(commitToSyncFormat),
						pushBranches: localBranches,
						pushTags: localTags,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Sync failed: ${response.statusText}`);
			}

			const result = await response.json();

			// Store pulled commits
			let pulled = 0;
			for (const commit of result.pull.commits) {
				const existing = await this.storage.getCommit(commit.id);
				if (!existing) {
					await this.storage.saveCommit(serverCommitToLocal(commit));
					pulled++;
				}
			}

			this.updateState({
				status: "synced",
				lastSyncAt: new Date().toISOString(),
				commitsAhead: 0,
				commitsBehind: 0,
			});

			return { pushed: result.pushed, pulled };
		} catch (error) {
			if (!navigator.onLine) {
				this.updateState({ status: "offline", error: null });
			} else {
				const msg = error instanceof Error ? error.message : "Sync failed";
				this.updateState({ status: "error", error: msg });
			}
			throw error;
		}
	}

	// ─── Auto-Sync ────────────────────────────────────────────────────────

	startAutoSync(intervalMs = 60_000): void {
		this.stopAutoSync();
		this.autoSyncTimer = setInterval(() => {
			if (navigator.onLine && this.repoId) {
				this.sync().catch(() => {});
			}
		}, intervalMs);

		// Listen for online/offline
		if (typeof window !== "undefined") {
			window.addEventListener("online", this.handleOnline);
			window.addEventListener("offline", this.handleOffline);
		}
	}

	stopAutoSync(): void {
		if (this.autoSyncTimer) {
			clearInterval(this.autoSyncTimer);
			this.autoSyncTimer = null;
		}
		if (typeof window !== "undefined") {
			window.removeEventListener("online", this.handleOnline);
			window.removeEventListener("offline", this.handleOffline);
		}
	}

	private handleOnline = (): void => {
		if (this.state.status === "offline") {
			this.updateState({ status: "unsynced" });
			this.sync().catch(() => {});
		}
	};

	private handleOffline = (): void => {
		this.updateState({ status: "offline" });
	};

	// ─── State Management ─────────────────────────────────────────────────

	getState(): SyncState {
		return { ...this.state };
	}

	subscribe(listener: (state: SyncState) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private updateState(partial: Partial<SyncState>): void {
		this.state = { ...this.state, ...partial };
		for (const listener of this.listeners) listener(this.state);
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function commitToSyncFormat(commit: Commit): Record<string, unknown> {
	return {
		id: commit.id,
		parentId: commit.parentId,
		hash: commit.id, // Use ID as hash for local commits
		message: commit.message,
		isKeyframe: commit.isKeyframe,
		snapshotData: commit.snapshot,
		deltaData: commit.delta,
		keyframeAncestorId: commit.keyframeAncestorId,
		thumbnailUrl: commit.thumbnailUrl,
		duration: commit.duration,
		trackCount: commit.trackCount,
		elementCount: commit.elementCount,
		changeSummary: commit.changeSummary,
		isAutoCommit: commit.isAutoCommit,
	};
}

function serverCommitToLocal(server: Record<string, unknown>): Commit {
	return {
		id: server.id as string,
		parentId: (server.parentId as string) ?? null,
		projectId: (server.repoId as string) ?? "",
		timestamp: (server.createdAt as string) ?? new Date().toISOString(),
		message: server.message as string,
		author: (server.authorName as string) ?? "remote",
		snapshot: (server.snapshotData as Commit["snapshot"]) ?? null,
		delta: (server.deltaData as Commit["delta"]) ?? null,
		isKeyframe: (server.isKeyframe as boolean) ?? false,
		keyframeAncestorId: (server.keyframeAncestorId as string) ?? null,
		thumbnailUrl: (server.thumbnailUrl as string) ?? undefined,
		duration: (server.duration as number) ?? 0,
		trackCount: (server.trackCount as number) ?? 0,
		elementCount: (server.elementCount as number) ?? 0,
		changeSummary: (server.changeSummary as Commit["changeSummary"]) ?? {
			tracksAdded: 0,
			tracksRemoved: 0,
			elementsAdded: 0,
			elementsRemoved: 0,
			elementsModified: 0,
			propertiesChanged: [],
		},
		isAutoCommit: (server.isAutoCommit as boolean) ?? false,
	};
}
