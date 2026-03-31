import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { generateUUID } from "@/utils/id";

const createBranchSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	headCommitId: z.string(),
	description: z.string().optional(),
	color: z.string().optional(),
	createdFromBranch: z.string().optional(),
	createdFromCommitId: z.string().optional(),
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
		const parsed = createBranchSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}

		const branch = {
			id: parsed.data.id || generateUUID(),
			repoId,
			...parsed.data,
			isProtected: false,
			createdAt: new Date(),
		};

		await db.insert(branches).values(branch).onConflictDoNothing();
		return NextResponse.json(branch, { status: 201 });
	} catch (error) {
		console.error("Error creating branch:", error);
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
		const result = await db
			.select()
			.from(branches)
			.where(eq(branches.repoId, repoId));

		return NextResponse.json(result);
	} catch (error) {
		console.error("Error listing branches:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
