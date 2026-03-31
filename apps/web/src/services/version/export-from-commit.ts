import type { SerializedVersionSnapshot, Commit } from "@/types/version";
import type { TScene } from "@/types/timeline";
import type { EditorCore } from "@/core";

/**
 * P5-06: Export a video from any historical commit without restoring it first.
 * Reconstructs the snapshot and renders using the existing export pipeline.
 *
 * NOTE: This requires building a render tree from the snapshot. The full
 * implementation depends on the export pipeline accepting a standalone snapshot.
 * This module provides the snapshot preparation; the actual render is delegated
 * to the editor's export system.
 */

export interface ExportFromCommitOptions {
	commitId: string;
	format?: "mp4" | "webm";
	quality?: "low" | "medium" | "high";
}

export interface ExportFromCommitResult {
	success: boolean;
	commitId: string;
	commitMessage: string;
	error?: string;
}

/**
 * Prepare a snapshot for export. Returns deserialized scenes and settings
 * that can be fed into the export pipeline.
 */
export async function prepareCommitForExport(
	editor: EditorCore,
	commitId: string,
): Promise<{
	scenes: TScene[];
	settings: SerializedVersionSnapshot["settings"];
	commit: Commit;
} | null> {
	const storage = editor.version.getStorage();
	if (!storage) return null;

	const commit = await storage.getCommit(commitId);
	if (!commit) return null;

	const snapshot = await storage.reconstructSnapshot(commitId);
	if (!snapshot) return null;

	const scenes = snapshot.scenes.map((s) => ({
		...s,
		createdAt: new Date(s.createdAt),
		updatedAt: new Date(s.updatedAt),
	})) as TScene[];

	return { scenes, settings: snapshot.settings, commit };
}

/**
 * Batch export: prepare multiple tagged commits for export.
 */
export async function prepareTaggedCommitsForExport(
	editor: EditorCore,
): Promise<Array<{ commitId: string; commitMessage: string; tag: string }>> {
	const tags = await editor.version.listTags();
	const results: Array<{ commitId: string; commitMessage: string; tag: string }> = [];

	for (const tag of tags) {
		const commit = await editor.version.getCommit(tag.commitId);
		if (commit) {
			results.push({
				commitId: commit.id,
				commitMessage: commit.message,
				tag: tag.name,
			});
		}
	}

	return results;
}
