import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { commits } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

const createCommitSchema = z.object({
	id: z.string(),
	parentId: z.string().nullable(),
	mergeParentId: z.string().nullable().optional(),
	hash: z.string(),
	message: z.string(),
	isKeyframe: z.boolean(),
	snapshotData: z.unknown().nullable(),
	deltaData: z.unknown().nullable(),
	keyframeAncestorId: z.string().nullable().optional(),
	thumbnailUrl: z.string().nullable().optional(),
	duration: z.number(),
	trackCount: z.number(),
	elementCount: z.number(),
	changeSummary: z.unknown(),
	isAutoCommit: z.boolean().optional(),
	mergeSourceBranch: z.string().nullable().optional(),
});

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

		// Support batch push (array of commits)
		const commitList = Array.isArray(body) ? body : [body];

		for (const raw of commitList) {
			const parsed = createCommitSchema.safeParse(raw);
			if (!parsed.success) {
				return NextResponse.json(
					{ error: "Invalid commit data", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await db.insert(commits).values({
				...parsed.data,
				repoId,
				authorId: session.user.id,
				authorName: session.user.name,
				authorAvatar: session.user.image,
				createdAt: new Date(),
			}).onConflictDoNothing();
		}

		return NextResponse.json({ pushed: commitList.length }, { status: 201 });
	} catch (error) {
		console.error("Error pushing commits:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ repoId: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId } = await params;
		const { searchParams } = new URL(request.url);
		const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
		const offset = parseInt(searchParams.get("offset") || "0", 10);

		const result = await db
			.select()
			.from(commits)
			.where(eq(commits.repoId, repoId))
			.orderBy(desc(commits.createdAt))
			.limit(limit)
			.offset(offset);

		return NextResponse.json(result);
	} catch (error) {
		console.error("Error listing commits:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
