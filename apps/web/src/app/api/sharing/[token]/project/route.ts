import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	shareLinks,
	commits,
	commitMediaRefs,
	projectRepositories,
} from "@/lib/db/schema-version-control";
import { getShareLinkByToken, checkShareGate } from "@/lib/sharing/share-server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Public: resolve a share token into the pinned snapshot + media manifest.
 * Increments the view counter once per successful fetch.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { token } = await params;
		const link = await getShareLinkByToken(token);
		if (!link) {
			return NextResponse.json({ error: "Link not found" }, { status: 404 });
		}

		const gate = await checkShareGate(link);
		if (!gate.ok) {
			return NextResponse.json(
				{ error: gate.error, passwordRequired: gate.passwordRequired ?? false },
				{ status: gate.status },
			);
		}

		const commitRows = await db
			.select()
			.from(commits)
			.where(eq(commits.id, link.commitId))
			.limit(1);
		if (commitRows.length === 0 || !commitRows[0].snapshotData) {
			return NextResponse.json({ error: "Link not found" }, { status: 404 });
		}
		const commit = commitRows[0];

		const repoRows = await db
			.select({ name: projectRepositories.name })
			.from(projectRepositories)
			.where(eq(projectRepositories.id, link.repoId))
			.limit(1);

		// mediaId → hash for every media object referenced by the pinned commit
		const refs = await db
			.select({
				mediaId: commitMediaRefs.mediaId,
				mediaHash: commitMediaRefs.mediaHash,
			})
			.from(commitMediaRefs)
			.where(eq(commitMediaRefs.commitId, link.commitId));
		const media: Record<string, string> = {};
		for (const ref of refs) {
			media[ref.mediaId] = ref.mediaHash;
		}

		await db
			.update(shareLinks)
			.set({ viewCount: sql`${shareLinks.viewCount} + 1` })
			.where(eq(shareLinks.id, link.id));

		return NextResponse.json({
			link: {
				commitId: commit.id,
				commitMessage: commit.message,
				allowDownload: link.allowDownload,
				expiresAt: link.expiresAt?.toISOString() ?? null,
				projectName: repoRows[0]?.name ?? "Untitled project",
			},
			snapshot: commit.snapshotData,
			media,
		});
	} catch (error) {
		console.error("Error loading shared project:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
