import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { commits, branches, tags } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

const syncRequestSchema = z.object({
	/** Commit IDs the client already has */
	knownCommitIds: z.array(z.string()),
	/** New commits to push to server */
	pushCommits: z.array(z.unknown()).optional(),
	/** Branch updates to push */
	pushBranches: z.array(z.unknown()).optional(),
	/** Tag updates to push */
	pushTags: z.array(z.unknown()).optional(),
});

/**
 * Bulk sync endpoint: push local changes AND pull remote changes in one request.
 * Returns commits/branches/tags that the client doesn't have.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ repoId: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId } = await params;
		const body = await request.json();
		const parsed = syncRequestSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request" }, { status: 400 });
		}

		const { knownCommitIds, pushCommits, pushBranches, pushTags } = parsed.data;

		// ── Push: insert new commits from client ──────────────────────────
		let pushedCount = 0;
		if (pushCommits && pushCommits.length > 0) {
			for (const raw of pushCommits) {
				const commit = raw as Record<string, unknown>;
				await db
					.insert(commits)
					.values({
						id: commit.id as string,
						repoId,
						parentId: (commit.parentId as string) ?? null,
						mergeParentId: (commit.mergeParentId as string) ?? null,
						hash: (commit.hash as string) || (commit.id as string),
						message: commit.message as string,
						authorId: session.user.id,
						authorName: session.user.name,
						authorAvatar: session.user.image,
						isKeyframe: (commit.isKeyframe as boolean) ?? false,
						snapshotData: commit.snapshotData ?? null,
						deltaData: commit.deltaData ?? null,
						keyframeAncestorId: (commit.keyframeAncestorId as string) ?? null,
						thumbnailUrl: (commit.thumbnailUrl as string) ?? null,
						duration: (commit.duration as number) ?? 0,
						trackCount: (commit.trackCount as number) ?? 0,
						elementCount: (commit.elementCount as number) ?? 0,
						changeSummary: commit.changeSummary ?? null,
						isAutoCommit: (commit.isAutoCommit as boolean) ?? false,
						mergeSourceBranch: (commit.mergeSourceBranch as string) ?? null,
						createdAt: new Date(),
					})
					.onConflictDoNothing();
				pushedCount++;
			}
		}

		// Push branches
		if (pushBranches && pushBranches.length > 0) {
			for (const raw of pushBranches) {
				const branch = raw as Record<string, unknown>;
				await db
					.insert(branches)
					.values({
						id: branch.id as string,
						repoId,
						name: branch.name as string,
						headCommitId: branch.headCommitId as string,
						description: (branch.description as string) ?? null,
						color: (branch.color as string) ?? null,
						createdFromBranch: (branch.createdFromBranch as string) ?? null,
						createdFromCommitId: (branch.createdFromCommitId as string) ?? null,
						isProtected: false,
						createdAt: new Date(),
					})
					.onConflictDoNothing();
			}
		}

		// Push tags
		if (pushTags && pushTags.length > 0) {
			for (const raw of pushTags) {
				const tag = raw as Record<string, unknown>;
				await db
					.insert(tags)
					.values({
						id: tag.id as string,
						repoId,
						commitId: tag.commitId as string,
						name: tag.name as string,
						type: (tag.type as string) ?? "custom",
						note: (tag.note as string) ?? null,
						createdBy: session.user.id,
						createdAt: new Date(),
					})
					.onConflictDoNothing();
			}
		}

		// ── Pull: find commits server has that client doesn't ─────────────
		let pullCommits: typeof commits.$inferSelect[] = [];
		if (knownCommitIds.length > 0) {
			pullCommits = await db
				.select()
				.from(commits)
				.where(
					eq(commits.repoId, repoId),
				);
			// Filter out known commits in JS to avoid SQL size limits
			const knownSet = new Set(knownCommitIds);
			pullCommits = pullCommits.filter((c) => !knownSet.has(c.id));
		} else {
			pullCommits = await db
				.select()
				.from(commits)
				.where(eq(commits.repoId, repoId));
		}

		const pullBranches = await db
			.select()
			.from(branches)
			.where(eq(branches.repoId, repoId));

		const pullTags = await db
			.select()
			.from(tags)
			.where(eq(tags.repoId, repoId));

		return NextResponse.json({
			pushed: pushedCount,
			pull: {
				commits: pullCommits,
				branches: pullBranches,
				tags: pullTags,
			},
		});
	} catch (error) {
		console.error("Error syncing:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
