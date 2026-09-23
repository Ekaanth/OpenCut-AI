import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import type { ShareLink, ShareConfig } from "@/lib/sharing/share-types";
import { toast } from "sonner";

/**
 * Real, server-persisted share links.
 *
 * Creating a link: ensures a remote repo exists for the project, commits
 * working changes, pins the reconstructed snapshot of the head commit,
 * uploads the media the snapshot references (deduped server-side), then
 * mints the link. Reviewers see exactly the pinned commit.
 */

async function ensureRemoteRepo(
	projectId: string,
	name: string,
): Promise<string> {
	const listRes = await fetch("/api/version-control/repos");
	if (listRes.ok) {
		const { repos } = (await listRes.json()) as {
			repos: Array<{ id: string; projectId: string }>;
		};
		const existing = repos.find((repo) => repo.projectId === projectId);
		if (existing) return existing.id;
	}
	const createRes = await fetch("/api/version-control/repos", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ projectId, name }),
	});
	if (!createRes.ok) {
		throw new Error(
			"Could not create the project repository. Are you signed in?",
		);
	}
	const repo = (await createRes.json()) as { id: string };
	return repo.id;
}

/** Collect mediaIds referenced anywhere in a serialized snapshot. */
function collectSnapshotMediaIds(snapshot: unknown): string[] {
	const ids = new Set<string>();
	const visit = (node: unknown, depth = 0) => {
		if (!node || typeof node !== "object" || depth > 8) return;
		if (Array.isArray(node)) {
			for (const item of node) visit(item, depth + 1);
			return;
		}
		const record = node as Record<string, unknown>;
		if (typeof record.mediaId === "string") ids.add(record.mediaId);
		for (const value of Object.values(record)) {
			if (value && typeof value === "object") visit(value, depth + 1);
		}
	};
	visit(snapshot);
	return [...ids];
}

export function useProjectSharing() {
	const editor = useEditor();
	const [sharedLinks, setSharedLinks] = useState<ShareLink[]>([]);
	const [isCreating, setIsCreating] = useState(false);

	const createShareLink = useCallback(
		async (config: Partial<ShareConfig> = {}) => {
			setIsCreating(true);
			try {
				const project = editor.project.getActive();
				const projectId = project.metadata.id;
				const projectName = project.metadata.name ?? "Untitled";
				const repoId = await ensureRemoteRepo(projectId, projectName);

				// Pin the current state: commit if dirty, then resolve head's snapshot
				if (editor.version.isDirty()) {
					await editor.version.commit("Shared for review", {
						isAutoCommit: true,
					});
				}
				const [head] = await editor.version.getLog(1);
				if (!head) {
					toast.error("Nothing to share yet — add some clips first");
					return null;
				}
				const snapshot = await editor.version.getSnapshot(head.id);
				if (!snapshot) {
					toast.error("Could not build a snapshot of this project");
					return null;
				}

				// Upload referenced media (deduped server-side; failures degrade
				// to placeholders in the review player rather than blocking the link)
				const mediaRefs: Array<{ mediaHash: string; mediaId: string }> = [];
				for (const mediaId of collectSnapshotMediaIds(snapshot)) {
					const asset = editor.media.getAssetById(mediaId);
					if (!asset?.file) continue;
					try {
						const form = new FormData();
						form.append("file", asset.file, asset.name || "media");
						const res = await fetch("/api/version-control/media", {
							method: "POST",
							body: form,
						});
						if (res.ok) {
							const { hash } = (await res.json()) as { hash: string };
							mediaRefs.push({ mediaHash: hash, mediaId });
						}
					} catch {
						// Skip this asset — the review page shows a placeholder
					}
				}

				const res = await fetch("/api/sharing/links", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						repoId,
						commit: {
							id: head.id,
							parentId: head.parentId,
							message: head.message,
							isKeyframe: true,
							snapshotData: snapshot,
							keyframeAncestorId: head.keyframeAncestorId,
							duration: head.duration,
							trackCount: head.trackCount,
							elementCount: head.elementCount,
							changeSummary: head.changeSummary,
							isAutoCommit: head.isAutoCommit,
						},
						mediaRefs,
						expiration: config.expiration ?? "7d",
						password: config.password,
						allowDownload: config.allowDownload ?? false,
					}),
				});

				if (!res.ok) {
					const { error } = (await res.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(error ?? "Failed to create share link");
				}

				const link = (await res.json()) as ShareLink;
				setSharedLinks((prev) => [link, ...prev]);
				await navigator.clipboard
					.writeText(link.url)
					.catch(() => undefined);
				toast.success("Review link copied to clipboard");
				return link;
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to share project",
				);
				return null;
			} finally {
				setIsCreating(false);
			}
		},
		[editor],
	);

	const listShareLinks = useCallback(async () => {
		const project = editor.project.getActive();
		const listRes = await fetch("/api/version-control/repos");
		if (!listRes.ok) return;
		const { repos } = (await listRes.json()) as {
			repos: Array<{ id: string; projectId: string }>;
		};
		const repo = repos.find((r) => r.projectId === project.metadata.id);
		if (!repo) {
			setSharedLinks([]);
			return;
		}
		const res = await fetch(`/api/sharing/links?repoId=${repo.id}`);
		if (!res.ok) return;
		const { links } = (await res.json()) as { links: ShareLink[] };
		setSharedLinks(links);
	}, [editor]);

	const revokeLink = useCallback(async (linkId: string) => {
		const res = await fetch(`/api/sharing/links/${linkId}`, {
			method: "DELETE",
		});
		if (res.ok) {
			setSharedLinks((prev) =>
				prev.map((l) => (l.id === linkId ? { ...l, revoked: true } : l)),
			);
			toast.success("Share link revoked");
		} else {
			toast.error("Could not revoke link");
		}
	}, []);

	return {
		sharedLinks,
		isCreating,
		createShareLink,
		listShareLinks,
		revokeLink,
	};
}
