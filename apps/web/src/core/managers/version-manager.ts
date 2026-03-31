import type { EditorCore } from "@/core";
import type {
	Commit,
	Branch,
	Tag,
	Stash,
	VersionStatus,
	SerializedVersionSnapshot,
	ChangeSummary,
	TimelineDiff,
	TagType,
	MergeResult,
} from "@/types/version";
import type { TProject } from "@/types/project";
import type { TScene } from "@/types/timeline";
import { VersionStorage, computeDelta } from "@/services/storage/version-storage";
import { diffProjects } from "@/services/diff/project-diff";
import { generateCommitThumbnail } from "@/services/version/thumbnail-generator";
import { mergeBranches, cherryPick, type CherryPickResult } from "@/services/merge/merge-engine";
import { ConflictResolver } from "@/services/merge/conflict-resolver";
import { generateUUID } from "@/utils/id";

export class VersionManager {
	private storage: VersionStorage | null = null;
	private currentBranchName = "main";
	private lastCommitId: string | null = null;
	private dirty = false;
	private initialized = false;
	private unsubscribeHandlers: Array<() => void> = [];

	// Auto-commit
	private autoCommitEnabled = false;
	private autoCommitIntervalMs = 10 * 60 * 1000; // 10 minutes
	private autoCommitTimer: ReturnType<typeof setInterval> | null = null;

	// Event listeners
	private commitListeners = new Set<(commit: Commit) => void>();
	private restoreListeners = new Set<() => void>();
	private statusListeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	// ─── Initialization ───────────────────────────────────────────────────────

	/**
	 * Initialize version control for a project.
	 * Creates the version DB, main branch, and initial commit if needed.
	 */
	async initialize(projectId: string): Promise<void> {
		this.storage = new VersionStorage(projectId);

		const mainBranch = await this.storage.getBranchByName("main");
		if (!mainBranch) {
			// First time — create main branch and initial commit
			await this.createInitialState(projectId);
		} else {
			this.currentBranchName = "main";
			this.lastCommitId = mainBranch.headCommitId;

			// Check if there's a persisted current branch
			const savedBranch = await this.storage.getMeta("currentBranch");
			if (savedBranch) {
				const branch = await this.storage.getBranchByName(savedBranch);
				if (branch) {
					this.currentBranchName = savedBranch;
					this.lastCommitId = branch.headCommitId;
				}
			}
		}

		this.dirty = false;
		this.initialized = true;
		this.startChangeTracking();
		this.notifyStatus();
	}

	private async createInitialState(projectId: string): Promise<void> {
		if (!this.storage) return;

		const snapshot = this.captureSnapshot();
		const commitId = generateUUID();
		const branchId = generateUUID();

		const commit: Commit = {
			id: commitId,
			parentId: null,
			projectId,
			timestamp: new Date().toISOString(),
			message: "Initial version",
			author: "local",
			snapshot: snapshot,
			delta: null,
			isKeyframe: true,
			keyframeAncestorId: null,
			duration: this.getProjectDuration(),
			trackCount: this.getTrackCount(),
			elementCount: this.getElementCount(),
			changeSummary: {
				tracksAdded: this.getTrackCount(),
				tracksRemoved: 0,
				elementsAdded: this.getElementCount(),
				elementsRemoved: 0,
				elementsModified: 0,
				propertiesChanged: [],
			},
		};

		const branch: Branch = {
			id: branchId,
			projectId,
			name: "main",
			headCommitId: commitId,
			createdAt: new Date().toISOString(),
			createdFromBranch: "main",
			createdFromCommitId: commitId,
		};

		await this.storage.saveCommit(commit);
		await this.storage.saveBranch(branch);
		await this.storage.setMeta("currentBranch", "main");

		this.currentBranchName = "main";
		this.lastCommitId = commitId;
	}

	// ─── Change Tracking ──────────────────────────────────────────────────────

	private startChangeTracking(): void {
		this.unsubscribeHandlers = [
			this.editor.scenes.subscribe(() => {
				this.markDirty();
			}),
			this.editor.timeline.subscribe(() => {
				this.markDirty();
			}),
		];
	}

	stopChangeTracking(): void {
		for (const unsub of this.unsubscribeHandlers) {
			unsub();
		}
		this.unsubscribeHandlers = [];
	}

	private markDirty(): void {
		if (!this.dirty) {
			this.dirty = true;
			this.notifyStatus();
		}
	}

	// ─── Commit Operations ────────────────────────────────────────────────────

	async commit(message: string, options?: { tag?: string; isAutoCommit?: boolean }): Promise<Commit> {
		if (!this.storage) throw new Error("Version control not initialized");

		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		const snapshot = this.captureSnapshot();
		const commitId = generateUUID();
		const isKeyframe = await this.storage.shouldBeKeyframe(this.lastCommitId);

		// Compute diff from parent for change summary
		let changeSummary: ChangeSummary = {
			tracksAdded: 0,
			tracksRemoved: 0,
			elementsAdded: 0,
			elementsRemoved: 0,
			elementsModified: 0,
			propertiesChanged: [],
		};

		let delta = null;

		if (this.lastCommitId) {
			const parentSnapshot = await this.storage.reconstructSnapshot(this.lastCommitId);
			if (parentSnapshot) {
				// Compute diff for summary
				const parentProject = this.snapshotToProject(parentSnapshot, project);
				const currentProject = this.snapshotToProject(snapshot, project);
				const diff = diffProjects(parentProject, currentProject);
				changeSummary = diff.changeSummary;

				// Compute delta for storage (if not keyframe)
				if (!isKeyframe) {
					delta = computeDelta(parentSnapshot, snapshot);
				}
			}
		}

		// Generate thumbnail (non-blocking — fallback to undefined on failure)
		const thumbnailUrl =
			(await generateCommitThumbnail(this.editor).catch(() => null)) ??
			undefined;

		const commit: Commit = {
			id: commitId,
			parentId: this.lastCommitId,
			projectId: project.metadata.id,
			timestamp: new Date().toISOString(),
			message,
			author: "local",
			snapshot: isKeyframe ? snapshot : null,
			delta: isKeyframe ? null : delta,
			isKeyframe,
			keyframeAncestorId: isKeyframe ? null : await this.findKeyframeAncestor(),
			thumbnailUrl,
			duration: this.getProjectDuration(),
			trackCount: this.getTrackCount(),
			elementCount: this.getElementCount(),
			changeSummary,
			isAutoCommit: options?.isAutoCommit,
		};

		await this.storage.saveCommit(commit);

		// Update branch head
		const branch = await this.storage.getBranchByName(this.currentBranchName);
		if (branch) {
			branch.headCommitId = commitId;
			await this.storage.saveBranch(branch);
		}

		this.lastCommitId = commitId;
		this.dirty = false;

		// Create tag if specified
		if (options?.tag) {
			await this.createTag(options.tag, commitId);
		}

		// Notify listeners
		for (const listener of this.commitListeners) listener(commit);
		this.notifyStatus();

		return commit;
	}

	async getLog(limit = 50): Promise<Commit[]> {
		if (!this.storage || !this.lastCommitId) return [];
		return this.storage.getCommitChain(this.lastCommitId, limit);
	}

	async getCommit(commitId: string): Promise<Commit | null> {
		if (!this.storage) return null;
		return this.storage.getCommit(commitId);
	}

	async getSnapshot(commitId: string): Promise<SerializedVersionSnapshot | null> {
		if (!this.storage) return null;
		return this.storage.reconstructSnapshot(commitId);
	}

	// ─── Restore ──────────────────────────────────────────────────────────────

	async restoreToCommit(commitId: string): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		const snapshot = await this.storage.reconstructSnapshot(commitId);
		if (!snapshot) throw new Error("Failed to reconstruct snapshot");

		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		// 1. Pause auto-save
		this.editor.save.pause();

		try {
			// 2. Deserialize scenes (ISO strings → Date objects)
			const scenes = snapshot.scenes.map((s) => ({
				...s,
				createdAt: new Date(s.createdAt),
				updatedAt: new Date(s.updatedAt),
			})) as TScene[];

			// 3. Apply snapshot to project
			project.scenes = scenes;
			project.settings = snapshot.settings;
			project.currentSceneId = snapshot.currentSceneId;

			// 4. Update scenes manager
			this.editor.scenes.setScenes({ scenes, activeSceneId: snapshot.currentSceneId });

			// 5. Reset playback
			this.editor.playback.seek({ time: 0 });

			// 6. Clear undo/redo stack
			this.editor.command.clear();

			// 7. Update branch head to restored commit
			const branch = await this.storage.getBranchByName(this.currentBranchName);
			if (branch) {
				branch.headCommitId = commitId;
				await this.storage.saveBranch(branch);
			}

			this.lastCommitId = commitId;
			this.dirty = false;

			// 8. Notify
			for (const listener of this.restoreListeners) listener();
			this.notifyStatus();
		} finally {
			// 9. Resume auto-save
			this.editor.save.resume();
			// Trigger a save of the restored state
			this.editor.save.markDirty({ force: true });
		}
	}

	// ─── Diff ─────────────────────────────────────────────────────────────────

	/**
	 * Diff between two commits.
	 */
	async diff(commitIdA: string, commitIdB: string): Promise<TimelineDiff | null> {
		if (!this.storage) return null;

		const snapshotA = await this.storage.reconstructSnapshot(commitIdA);
		const snapshotB = await this.storage.reconstructSnapshot(commitIdB);
		if (!snapshotA || !snapshotB) return null;

		const project = this.editor.project.getActive();
		if (!project) return null;

		const projectA = this.snapshotToProject(snapshotA, project);
		const projectB = this.snapshotToProject(snapshotB, project);
		return diffProjects(projectA, projectB);
	}

	/**
	 * Diff working state vs last commit.
	 */
	async diffWorkingState(): Promise<TimelineDiff | null> {
		if (!this.storage || !this.lastCommitId) return null;

		const lastSnapshot = await this.storage.reconstructSnapshot(this.lastCommitId);
		if (!lastSnapshot) return null;

		const project = this.editor.project.getActive();
		if (!project) return null;

		const lastProject = this.snapshotToProject(lastSnapshot, project);
		return diffProjects(lastProject, project);
	}

	// ─── Branches ─────────────────────────────────────────────────────────────

	private static readonly BRANCH_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/;

	async createBranch(name: string, fromCommitId?: string): Promise<Branch> {
		if (!this.storage) throw new Error("Version control not initialized");
		if (!VersionManager.BRANCH_NAME_RE.test(name)) {
			throw new Error("Branch name must be alphanumeric with hyphens/underscores, starting with a letter or number");
		}

		const existing = await this.storage.getBranchByName(name);
		if (existing) throw new Error(`Branch "${name}" already exists`);

		const sourceCommitId = fromCommitId ?? this.lastCommitId;
		if (!sourceCommitId) throw new Error("No commit to branch from");

		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		const branch: Branch = {
			id: generateUUID(),
			projectId: project.metadata.id,
			name,
			headCommitId: sourceCommitId,
			createdAt: new Date().toISOString(),
			createdFromBranch: this.currentBranchName,
			createdFromCommitId: sourceCommitId,
		};

		await this.storage.saveBranch(branch);
		this.notifyStatus();
		return branch;
	}

	async switchBranch(name: string): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");
		if (name === this.currentBranchName) return;

		const branch = await this.storage.getBranchByName(name);
		if (!branch) throw new Error(`Branch "${name}" not found`);

		// Restore to the branch head's snapshot
		await this.restoreToCommit(branch.headCommitId);

		this.currentBranchName = name;
		this.lastCommitId = branch.headCommitId;
		this.dirty = false;
		await this.storage.setMeta("currentBranch", name);
		this.notifyStatus();
	}

	async deleteBranch(name: string): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");
		if (name === "main") throw new Error("Cannot delete the main branch");
		if (name === this.currentBranchName) throw new Error("Cannot delete the current branch");

		const branch = await this.storage.getBranchByName(name);
		if (!branch) throw new Error(`Branch "${name}" not found`);

		await this.storage.deleteBranch(branch.id);
		this.notifyStatus();
	}

	async renameBranch(oldName: string, newName: string): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");
		if (!VersionManager.BRANCH_NAME_RE.test(newName)) {
			throw new Error("Branch name must be alphanumeric with hyphens/underscores");
		}

		const branch = await this.storage.getBranchByName(oldName);
		if (!branch) throw new Error(`Branch "${oldName}" not found`);

		const existing = await this.storage.getBranchByName(newName);
		if (existing) throw new Error(`Branch "${newName}" already exists`);

		branch.name = newName;
		await this.storage.saveBranch(branch);

		if (this.currentBranchName === oldName) {
			this.currentBranchName = newName;
			await this.storage.setMeta("currentBranch", newName);
		}
		this.notifyStatus();
	}

	async updateBranch(name: string, updates: { description?: string; color?: string }): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		const branch = await this.storage.getBranchByName(name);
		if (!branch) throw new Error(`Branch "${name}" not found`);

		if (updates.description !== undefined) branch.description = updates.description;
		if (updates.color !== undefined) branch.color = updates.color;

		await this.storage.saveBranch(branch);
		this.notifyStatus();
	}

	async listBranches(): Promise<Branch[]> {
		if (!this.storage) return [];
		return this.storage.getAllBranches();
	}

	async getBranch(name: string): Promise<Branch | null> {
		if (!this.storage) return null;
		return this.storage.getBranchByName(name);
	}

	// ─── Merge ────────────────────────────────────────────────────────────────

	private activeConflictResolver: ConflictResolver | null = null;

	/**
	 * Start a merge of sourceBranch into the current branch.
	 * Returns the merge result with conflicts (if any).
	 */
	async merge(sourceBranchName: string): Promise<MergeResult> {
		if (!this.storage) throw new Error("Version control not initialized");

		const result = await mergeBranches(
			this.storage,
			sourceBranchName,
			this.currentBranchName,
		);

		if (result.conflicts.length > 0) {
			// Store resolver for interactive conflict resolution
			const currentSnapshot = this.captureSnapshot();
			this.activeConflictResolver = new ConflictResolver(result, currentSnapshot);
		}

		return result;
	}

	/**
	 * Complete a clean merge (no conflicts) or after all conflicts resolved.
	 * Creates a merge commit on the current branch.
	 */
	async completeMerge(
		sourceBranchName: string,
		mergedSnapshot: SerializedVersionSnapshot,
		message?: string,
	): Promise<Commit> {
		if (!this.storage) throw new Error("Version control not initialized");

		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		// Apply merged snapshot to editor
		const scenes = mergedSnapshot.scenes.map((s) => ({
			...s,
			createdAt: new Date(s.createdAt),
			updatedAt: new Date(s.updatedAt),
		})) as TScene[];

		this.editor.save.pause();
		try {
			project.scenes = scenes;
			project.settings = mergedSnapshot.settings;
			project.currentSceneId = mergedSnapshot.currentSceneId;
			this.editor.scenes.setScenes({ scenes, activeSceneId: mergedSnapshot.currentSceneId });
			this.editor.playback.seek({ time: 0 });
			this.editor.command.clear();
		} finally {
			this.editor.save.resume();
			this.editor.save.markDirty({ force: true });
		}

		// Create merge commit
		const commitMessage = message ?? `Merge ${sourceBranchName} into ${this.currentBranchName}`;
		const commit = await this.commit(commitMessage);

		this.activeConflictResolver = null;
		return commit;
	}

	getConflictResolver(): ConflictResolver | null {
		return this.activeConflictResolver;
	}

	abortMerge(): void {
		this.activeConflictResolver = null;
	}

	/**
	 * Cherry-pick a commit's changes onto the current branch.
	 */
	async cherryPickCommit(commitId: string): Promise<CherryPickResult> {
		if (!this.storage) throw new Error("Version control not initialized");

		const currentSnapshot = this.captureSnapshot();
		return cherryPick(this.storage, commitId, currentSnapshot);
	}

	// ─── Tags ─────────────────────────────────────────────────────────────────

	async createTag(
		name: string,
		commitId?: string,
		type: TagType = "custom",
		note?: string,
	): Promise<Tag> {
		if (!this.storage) throw new Error("Version control not initialized");

		const tag: Tag = {
			id: generateUUID(),
			commitId: commitId ?? this.lastCommitId!,
			name,
			type,
			note,
			createdAt: new Date().toISOString(),
			createdBy: "local",
		};

		await this.storage.saveTag(tag);
		return tag;
	}

	async listTags(): Promise<Tag[]> {
		if (!this.storage) return [];
		return this.storage.getAllTags();
	}

	async deleteTag(name: string): Promise<void> {
		if (!this.storage) return;
		await this.storage.deleteTag(name);
	}

	async getTagsForCommit(commitId: string): Promise<Tag[]> {
		if (!this.storage) return [];
		return this.storage.getTagsForCommit(commitId);
	}

	// ─── Status ───────────────────────────────────────────────────────────────

	status(): VersionStatus {
		return {
			currentBranch: this.currentBranchName,
			isDirty: this.dirty,
			lastCommitId: this.lastCommitId,
			uncommittedChangesCount: 0, // Could be computed from diff, but expensive
		};
	}

	isDirty(): boolean {
		return this.dirty;
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	getCurrentBranch(): string {
		return this.currentBranchName;
	}

	getLastCommitId(): string | null {
		return this.lastCommitId;
	}

	getStorage(): VersionStorage | null {
		return this.storage;
	}

	// ─── Events ───────────────────────────────────────────────────────────────

	onCommit(listener: (commit: Commit) => void): () => void {
		this.commitListeners.add(listener);
		return () => this.commitListeners.delete(listener);
	}

	onRestore(listener: () => void): () => void {
		this.restoreListeners.add(listener);
		return () => this.restoreListeners.delete(listener);
	}

	subscribeStatus(listener: () => void): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	private notifyStatus(): void {
		for (const listener of this.statusListeners) listener();
	}

	// ─── Auto-Commit ─────────────────────────────────────────────────────────

	setAutoCommit(enabled: boolean, intervalMinutes?: number): void {
		this.autoCommitEnabled = enabled;
		if (intervalMinutes !== undefined) {
			this.autoCommitIntervalMs = intervalMinutes * 60 * 1000;
		}
		this.stopAutoCommitTimer();
		if (enabled) {
			this.startAutoCommitTimer();
		}
		this.notifyStatus();
	}

	getAutoCommitEnabled(): boolean {
		return this.autoCommitEnabled;
	}

	getAutoCommitIntervalMinutes(): number {
		return this.autoCommitIntervalMs / 60 / 1000;
	}

	private startAutoCommitTimer(): void {
		if (this.autoCommitTimer) return;
		this.autoCommitTimer = setInterval(() => {
			void this.tryAutoCommit();
		}, this.autoCommitIntervalMs);
	}

	private stopAutoCommitTimer(): void {
		if (this.autoCommitTimer) {
			clearInterval(this.autoCommitTimer);
			this.autoCommitTimer = null;
		}
	}

	private async tryAutoCommit(): Promise<void> {
		if (!this.dirty || !this.initialized || !this.storage) return;

		try {
			const diff = await this.diffWorkingState();
			const changeCount = diff?.totalChanges ?? 0;
			if (changeCount === 0) return;

			await this.commit(`Auto-save: ${changeCount} change${changeCount !== 1 ? "s" : ""}`, {
				isAutoCommit: true,
				tag: undefined,
			});
		} catch (err) {
			console.warn("Auto-commit failed:", err);
		}
	}

	// ─── Rebase (P5-02) ──────────────────────────────────────────────────────

	async rebase(
		startCommitId: string,
		actions: Array<{ commitId: string; action: "pick" | "squash" | "drop" | "reword"; newMessage?: string }>,
	): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		// Walk the commit chain from HEAD to startCommit
		const chain = await this.storage.getCommitChain(this.lastCommitId!, 500);
		const startIdx = chain.findIndex((c) => c.id === startCommitId);
		if (startIdx === -1) throw new Error("Start commit not found in current branch history");

		// Commits to rebase: from startCommit to HEAD (reverse order for applying)
		const toRebase = chain.slice(0, startIdx).reverse();
		const actionMap = new Map(actions.map((a) => [a.commitId, a]));

		// Build the new commit chain
		let parentId = startCommitId;
		const newCommits: Commit[] = [];
		let pendingSquash: Commit | null = null;

		for (const commit of toRebase) {
			const act = actionMap.get(commit.id);
			const action = act?.action ?? "pick";

			if (action === "drop") continue;

			if (action === "squash") {
				// Merge this commit's snapshot into the pending one
				if (pendingSquash) {
					// Keep the pending commit, just update its snapshot to this one's
					const latestSnapshot = await this.storage.reconstructSnapshot(commit.id);
					if (latestSnapshot) {
						pendingSquash.snapshot = latestSnapshot;
						pendingSquash.isKeyframe = true;
						pendingSquash.delta = null;
						pendingSquash.message += `\n${commit.message}`;
					}
				}
				continue;
			}

			// Flush any pending squash
			if (pendingSquash) {
				pendingSquash.parentId = parentId;
				newCommits.push(pendingSquash);
				parentId = pendingSquash.id;
				pendingSquash = null;
			}

			const snapshot = await this.storage.reconstructSnapshot(commit.id);
			const newCommit: Commit = {
				...commit,
				id: generateUUID(),
				parentId,
				snapshot,
				delta: null,
				isKeyframe: true,
				keyframeAncestorId: null,
				message: action === "reword" && act?.newMessage ? act.newMessage : commit.message,
			};

			if (action === "pick" || action === "reword") {
				newCommits.push(newCommit);
				parentId = newCommit.id;
			}

			// If next commit might squash into this one
			const nextIdx = toRebase.indexOf(commit) + 1;
			if (nextIdx < toRebase.length) {
				const nextAct = actionMap.get(toRebase[nextIdx].id);
				if (nextAct?.action === "squash") {
					pendingSquash = newCommit;
					continue;
				}
			}
		}

		// Flush final pending squash
		if (pendingSquash) {
			pendingSquash.parentId = parentId;
			newCommits.push(pendingSquash);
			parentId = pendingSquash.id;
		}

		// Save all new commits
		for (const c of newCommits) {
			await this.storage.saveCommit(c);
		}

		// Update branch head
		if (newCommits.length > 0) {
			const newHead = newCommits[newCommits.length - 1];
			const branch = await this.storage.getBranchByName(this.currentBranchName);
			if (branch) {
				branch.headCommitId = newHead.id;
				await this.storage.saveBranch(branch);
			}
			this.lastCommitId = newHead.id;
		}

		this.notifyStatus();
	}

	// ─── Bisect (P5-03) ──────────────────────────────────────────────────────

	private bisectState: {
		goodCommitId: string;
		badCommitId: string;
		commits: Commit[];
		currentIdx: number;
		low: number;
		high: number;
	} | null = null;

	async bisectStart(goodCommitId: string, badCommitId: string): Promise<string> {
		if (!this.storage) throw new Error("Version control not initialized");

		// Get all commits between good and bad
		const chain = await this.storage.getCommitChain(badCommitId, 1000);
		const goodIdx = chain.findIndex((c) => c.id === goodCommitId);
		if (goodIdx === -1) throw new Error("Good commit not found in history");

		const commits = chain.slice(0, goodIdx + 1); // bad → good (newest first)

		this.bisectState = {
			goodCommitId,
			badCommitId,
			commits,
			currentIdx: Math.floor(commits.length / 2),
			low: 0,
			high: commits.length - 1,
		};

		// Restore to the midpoint
		const mid = this.bisectState.commits[this.bisectState.currentIdx];
		await this.restoreToCommit(mid.id);
		return mid.id;
	}

	async bisectGood(): Promise<{ done: boolean; commitId: string; remaining: number }> {
		if (!this.bisectState) throw new Error("No bisect in progress");

		// Current commit is good — problem is between low and current
		this.bisectState.high = this.bisectState.currentIdx;
		return this.bisectStep();
	}

	async bisectBad(): Promise<{ done: boolean; commitId: string; remaining: number }> {
		if (!this.bisectState) throw new Error("No bisect in progress");

		// Current commit is bad — problem is between current and high
		this.bisectState.low = this.bisectState.currentIdx;
		return this.bisectStep();
	}

	private async bisectStep(): Promise<{ done: boolean; commitId: string; remaining: number }> {
		const bs = this.bisectState!;
		const remaining = bs.high - bs.low;

		if (remaining <= 1) {
			// Found it — the bad commit is at bs.low
			const found = bs.commits[bs.low];
			this.bisectState = null;
			return { done: true, commitId: found.id, remaining: 0 };
		}

		bs.currentIdx = Math.floor((bs.low + bs.high) / 2);
		const mid = bs.commits[bs.currentIdx];
		await this.restoreToCommit(mid.id);
		return { done: false, commitId: mid.id, remaining };
	}

	bisectAbort(): void {
		this.bisectState = null;
	}

	getBisectState(): { active: boolean; remaining: number; currentCommitId: string | null } {
		if (!this.bisectState) return { active: false, remaining: 0, currentCommitId: null };
		return {
			active: true,
			remaining: this.bisectState.high - this.bisectState.low,
			currentCommitId: this.bisectState.commits[this.bisectState.currentIdx]?.id ?? null,
		};
	}

	// ─── Stash ────────────────────────────────────────────────────────────────

	async stash(message?: string): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");
		if (!this.dirty) throw new Error("No changes to stash");

		const snapshot = this.captureSnapshot();
		const stash: Stash = {
			id: generateUUID(),
			branchId: this.currentBranchName,
			snapshot,
			message: message || `Stash on ${this.currentBranchName}`,
			createdAt: new Date().toISOString(),
		};

		await this.storage.saveStash(stash);

		// Restore to last commit (discard working changes)
		if (this.lastCommitId) {
			await this.restoreToCommit(this.lastCommitId);
		}
	}

	async stashPop(): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		const stashes = await this.storage.getAllStashes();
		if (stashes.length === 0) throw new Error("No stashes to pop");

		const latest = stashes[0];
		await this.applyStashSnapshot(latest.snapshot);
		await this.storage.deleteStash(latest.id);
	}

	async stashApply(index: number): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		const stashes = await this.storage.getAllStashes();
		if (index < 0 || index >= stashes.length) throw new Error("Stash index out of range");

		await this.applyStashSnapshot(stashes[index].snapshot);
	}

	async stashList(): Promise<Stash[]> {
		if (!this.storage) return [];
		return this.storage.getAllStashes();
	}

	async stashDrop(index: number): Promise<void> {
		if (!this.storage) throw new Error("Version control not initialized");

		const stashes = await this.storage.getAllStashes();
		if (index < 0 || index >= stashes.length) throw new Error("Stash index out of range");

		await this.storage.deleteStash(stashes[index].id);
	}

	private async applyStashSnapshot(
		snapshot: SerializedVersionSnapshot,
	): Promise<void> {
		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		const scenes = snapshot.scenes.map((s) => ({
			...s,
			createdAt: new Date(s.createdAt),
			updatedAt: new Date(s.updatedAt),
		})) as TScene[];

		project.scenes = scenes;
		project.settings = snapshot.settings;
		project.currentSceneId = snapshot.currentSceneId;
		this.editor.scenes.setScenes({ scenes, activeSceneId: snapshot.currentSceneId });
		this.dirty = true;
		this.notifyStatus();
	}

	// ─── Cleanup ──────────────────────────────────────────────────────────────

	async deleteVersionDB(): Promise<void> {
		this.stopChangeTracking();
		this.stopAutoCommitTimer();
		if (this.storage) {
			await this.storage.deleteDatabase();
			this.storage = null;
		}
		this.initialized = false;
		this.lastCommitId = null;
		this.dirty = false;
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	private captureSnapshot(): SerializedVersionSnapshot {
		const project = this.editor.project.getActive();
		if (!project) throw new Error("No active project");

		return {
			scenes: project.scenes.map((s) => ({
				...s,
				tracks: s.tracks.map((t) => {
					if (t.type === "audio") {
						// Strip AudioBuffer from audio elements
						return {
							...t,
							elements: t.elements.map(({ buffer: _buffer, ...rest }) => rest),
						};
					}
					return t;
				}),
				createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
				updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
			})),
			settings: { ...project.settings },
			currentSceneId: project.currentSceneId,
		};
	}

	private snapshotToProject(
		snapshot: SerializedVersionSnapshot,
		baseProject: TProject,
	): TProject {
		return {
			...baseProject,
			scenes: snapshot.scenes.map((s) => ({
				...s,
				createdAt: new Date(s.createdAt),
				updatedAt: new Date(s.updatedAt),
			})) as TScene[],
			settings: snapshot.settings,
			currentSceneId: snapshot.currentSceneId,
		};
	}

	private getProjectDuration(): number {
		const project = this.editor.project.getActiveOrNull();
		return project?.metadata.duration ?? 0;
	}

	private getTrackCount(): number {
		const project = this.editor.project.getActiveOrNull();
		if (!project) return 0;
		return project.scenes.reduce((sum, s) => sum + s.tracks.length, 0);
	}

	private getElementCount(): number {
		const project = this.editor.project.getActiveOrNull();
		if (!project) return 0;
		return project.scenes.reduce(
			(sum, s) =>
				sum + s.tracks.reduce((tSum, t) => tSum + t.elements.length, 0),
			0,
		);
	}

	private async findKeyframeAncestor(): Promise<string | null> {
		if (!this.storage || !this.lastCommitId) return null;
		let currentId: string | null = this.lastCommitId;
		while (currentId) {
			const commit = await this.storage.getCommit(currentId);
			if (!commit) return null;
			if (commit.isKeyframe) return commit.id;
			currentId = commit.parentId;
		}
		return null;
	}
}
