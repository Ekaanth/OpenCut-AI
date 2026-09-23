import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewComments } from "@/lib/db/schema-version-control";
import { getShareLinkByToken, checkShareGate } from "@/lib/sharing/share-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateUUID } from "@/utils/id";

const listQuerySchema = z.object({
	includeResolved: z.coerce.boolean().default(true),
});

const createCommentSchema = z.object({
	authorName: z.string().trim().min(1).max(60),
	body: z.string().trim().min(1).max(2000),
	timeSeconds: z.number().min(0),
	timelineTrackId: z.string().nullable().optional(),
	timelineElementId: z.string().nullable().optional(),
	parentId: z.string().nullable().optional(),
});

/** Public: list comments for a share link, ordered by timeline position. */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
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

		const parsed = listQuerySchema.safeParse(
			Object.fromEntries(request.nextUrl.searchParams),
		);
		const includeResolved = parsed.success ? parsed.data.includeResolved : true;

		const rows = await db
			.select()
			.from(reviewComments)
			.where(eq(reviewComments.shareLinkId, link.id))
			.orderBy(asc(reviewComments.timeSeconds), asc(reviewComments.createdAt));

		const comments = rows
			.filter((row) => includeResolved || !row.resolvedAt)
			.map((row) => ({
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
			}));

		return NextResponse.json({ comments });
	} catch (error) {
		console.error("Error listing comments:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/** Public: add a frame-anchored comment as an anonymous reviewer. */
export async function POST(
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

		const body = await request.json();
		const parsed = createCommentSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: parsed.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}

		const inserted = await db
			.insert(reviewComments)
			.values({
				id: generateUUID(),
				shareLinkId: link.id,
				repoId: link.repoId,
				timeSeconds: parsed.data.timeSeconds,
				timelineTrackId: parsed.data.timelineTrackId ?? null,
				timelineElementId: parsed.data.timelineElementId ?? null,
				body: parsed.data.body,
				authorName: parsed.data.authorName,
				parentId: parsed.data.parentId ?? null,
			})
			.returning({ id: reviewComments.id, createdAt: reviewComments.createdAt });

		return NextResponse.json(
			{
				id: inserted[0].id,
				createdAt: inserted[0].createdAt.toISOString(),
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating comment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
