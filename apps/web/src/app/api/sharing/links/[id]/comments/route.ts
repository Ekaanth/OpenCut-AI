import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	projectRepositories,
	shareLinks,
	reviewComments,
} from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

const resolveSchema = z.object({
	commentId: z.string().min(1),
	resolved: z.boolean(),
});

async function getOwnedLink(id: string, userId: string) {
	const rows = await db
		.select({ link: shareLinks, repo: projectRepositories })
		.from(shareLinks)
		.innerJoin(
			projectRepositories,
			eq(shareLinks.repoId, projectRepositories.id),
		)
		.where(eq(shareLinks.id, id))
		.limit(1);
	if (rows.length === 0 || rows[0].repo.userId !== userId) return null;
	return rows[0].link;
}

/** Owner: list all comments on a share link. */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const link = await getOwnedLink(id, session.user.id);
		if (!link) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const rows = await db
			.select()
			.from(reviewComments)
			.where(eq(reviewComments.shareLinkId, link.id))
			.orderBy(asc(reviewComments.timeSeconds), asc(reviewComments.createdAt));

		return NextResponse.json({
			comments: rows.map((row) => ({
				id: row.id,
				shareLinkId: row.shareLinkId,
				timeSeconds: row.timeSeconds,
				timelineTrackId: row.timelineTrackId,
				timelineElementId: row.timelineElementId,
				body: row.body,
				authorName: row.authorName,
				parentId: row.parentId,
				resolved: row.resolvedAt !== null,
				createdAt: row.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("Error listing owner comments:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/** Owner: resolve or unresolve a comment. */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const link = await getOwnedLink(id, session.user.id);
		if (!link) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const body = await request.json();
		const parsed = resolveSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request" }, { status: 400 });
		}

		await db
			.update(reviewComments)
			.set({
				resolvedAt: parsed.data.resolved ? new Date() : null,
				resolvedBy: parsed.data.resolved ? session.user.id : null,
			})
			.where(eq(reviewComments.id, parsed.data.commentId));

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error resolving comment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
