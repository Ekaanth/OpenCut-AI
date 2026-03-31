import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { generateUUID } from "@/utils/id";

const createTagSchema = z.object({
	id: z.string().optional(),
	commitId: z.string(),
	name: z.string().min(1),
	type: z.string().default("custom"),
	note: z.string().optional(),
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
		const parsed = createTagSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request" }, { status: 400 });
		}

		const tag = {
			id: parsed.data.id || generateUUID(),
			repoId,
			...parsed.data,
			createdBy: session.user.id,
			createdAt: new Date(),
		};

		await db.insert(tags).values(tag).onConflictDoNothing();
		return NextResponse.json(tag, { status: 201 });
	} catch (error) {
		console.error("Error creating tag:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ repoId: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId } = await params;
		const result = await db.select().from(tags).where(eq(tags.repoId, repoId));
		return NextResponse.json(result);
	} catch (error) {
		console.error("Error listing tags:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
