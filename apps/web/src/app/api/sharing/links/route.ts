import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	projectRepositories,
	shareLinks,
	commits,
	reviewComments,
	commitMediaRefs,
} from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { generateUUID } from "@/utils/id";
import {
	generateShareToken,
	hashSharePassword,
	SHARE_EXPIRATION_MS,
	formatShareUrl,
} from "@/lib/sharing/share-utils";

const createLinkSchema = z.object({
	repoId: z.string().min(1),
	/** The pinned commit, pushed from the client (same shape the sync route accepts) */
	commit: z.object({
		id: z.string().min(1),
		parentId: z.string().nullable().optional(),
		mergeParentId: z.string().nullable().optional(),
		hash: z.string().optional(),
		message: z.string().default("Shared for review"),
		isKeyframe: z.boolean().optional(),
		snapshotData: z.unknown(),
		deltaData: z.unknown().optional(),
		keyframeAncestorId: z.string().nullable().optional(),
		duration: z.number().optional(),
		trackCount: z.number().optional(),
		elementCount: z.number().optional(),
		changeSummary: z.unknown().optional(),
		isAutoCommit: z.boolean().optional(),
	}),
	mediaRefs: z
		.array(z.object({ mediaHash: z.string(), mediaId: z.string() }))
		.optional(),
	expiration: z.enum(["1h", "24h", "7d", "30d", "never"]).default("7d"),
	password: z.string().min(4).max(128).optional(),
	allowDownload: z.boolean().default(false),
});

/** Owner: list share links for a repo, newest first, with comment counts. */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const repoId = request.nextUrl.searchParams.get("repoId");
		if (!repoId) {
			return NextResponse.json({ error: "repoId is required" }, { status: 400 });
		}

		const repo = await db
			.select()
			.from(projectRepositories)
			.where(eq(projectRepositories.id, repoId))
			.limit(1);
		if (repo.length === 0 || repo[0].userId !== session.user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const rows = await db
			.select({
				id: shareLinks.id,
				repoId: shareLinks.repoId,
				commitId: shareLinks.commitId,
				token: shareLinks.token,
				expiresAt: shareLinks.expiresAt,
				hasPassword: sql<boolean>`${shareLinks.passwordHash} IS NOT NULL`,
				allowDownload: shareLinks.allowDownload,
				viewCount: shareLinks.viewCount,
				revokedAt: shareLinks.revokedAt,
				createdAt: shareLinks.createdAt,
				commentCount: sql<number>`(
					select count(*)::int from ${reviewComments}
					where ${reviewComments.shareLinkId} = ${shareLinks.id}
				)`,
				unresolvedCount: sql<number>`(
					select count(*)::int from ${reviewComments}
					where ${reviewComments.shareLinkId} = ${shareLinks.id}
					and ${reviewComments.resolvedAt} is null
				)`,
			})
			.from(shareLinks)
			.where(eq(shareLinks.repoId, repoId))
			.orderBy(desc(shareLinks.createdAt));

		const origin = request.nextUrl.origin;
		return NextResponse.json({
			links: rows.map((row) => ({
				id: row.id,
				repoId: row.repoId,
				commitId: row.commitId,
				token: row.token,
				url: formatShareUrl(origin, row.token),
				expiresAt: row.expiresAt?.toISOString() ?? null,
				hasPassword: row.hasPassword,
				allowDownload: row.allowDownload,
				views: row.viewCount,
				revoked: row.revokedAt !== null,
				createdAt: row.createdAt.toISOString(),
				commentCount: row.commentCount,
				unresolvedCount: row.unresolvedCount,
			})),
		});
	} catch (error) {
		console.error("Error listing share links:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/** Owner: create a share link pinned to a commit, upserting the commit first. */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const parsed = createLinkSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: parsed.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}
		const { repoId, commit, mediaRefs, expiration, password, allowDownload } =
			parsed.data;

		const repo = await db
			.select()
			.from(projectRepositories)
			.where(eq(projectRepositories.id, repoId))
			.limit(1);
		if (repo.length === 0 || repo[0].userId !== session.user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		// Upsert the pinned commit (idempotent — same insert shape as the sync route)
		await db
			.insert(commits)
			.values({
				id: commit.id,
				repoId,
				parentId: commit.parentId ?? null,
				mergeParentId: commit.mergeParentId ?? null,
				hash: commit.hash || commit.id,
				message: commit.message,
				authorId: session.user.id,
				authorName: session.user.name,
				authorAvatar: session.user.image,
				isKeyframe: commit.isKeyframe ?? false,
				snapshotData: commit.snapshotData ?? null,
				deltaData: commit.deltaData ?? null,
				keyframeAncestorId: commit.keyframeAncestorId ?? null,
				duration: commit.duration ?? 0,
				trackCount: commit.trackCount ?? 0,
				elementCount: commit.elementCount ?? 0,
				changeSummary: commit.changeSummary ?? null,
				isAutoCommit: commit.isAutoCommit ?? false,
				createdAt: new Date(),
			})
			.onConflictDoNothing();

		// Upsert media refs so the public media route can authorize hashes
		if (mediaRefs && mediaRefs.length > 0) {
			for (const ref of mediaRefs) {
				await db
					.insert(commitMediaRefs)
					.values({ commitId: commit.id, mediaHash: ref.mediaHash, mediaId: ref.mediaId })
					.onConflictDoNothing();
			}
		}

		const expirationMs = SHARE_EXPIRATION_MS[expiration];
		const token = generateShareToken();

		const inserted = await db
			.insert(shareLinks)
			.values({
				id: generateUUID(),
				repoId,
				commitId: commit.id,
				token,
				passwordHash: password ? hashSharePassword(password) : null,
				allowDownload,
				expiresAt: expirationMs ? new Date(Date.now() + expirationMs) : null,
				createdBy: session.user.id,
			})
			.returning({ id: shareLinks.id, createdAt: shareLinks.createdAt });

		return NextResponse.json(
			{
				id: inserted[0].id,
				url: formatShareUrl(request.nextUrl.origin, token),
				token,
				commitId: commit.id,
				expiresAt: expirationMs
					? new Date(Date.now() + expirationMs).toISOString()
					: null,
				hasPassword: Boolean(password),
				allowDownload,
				views: 0,
				revoked: false,
				createdAt: inserted[0].createdAt.toISOString(),
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating share link:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
