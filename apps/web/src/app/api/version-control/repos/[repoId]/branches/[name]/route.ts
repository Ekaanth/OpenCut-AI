import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

const updateBranchSchema = z.object({
	headCommitId: z.string().optional(),
	description: z.string().optional(),
	color: z.string().optional(),
});

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ repoId: string; name: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId, name } = await params;
		const body = await request.json();
		const parsed = updateBranchSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request" }, { status: 400 });
		}

		await db
			.update(branches)
			.set(parsed.data)
			.where(and(eq(branches.repoId, repoId), eq(branches.name, name)));

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error updating branch:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ repoId: string; name: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId, name } = await params;

		if (name === "main") {
			return NextResponse.json({ error: "Cannot delete main branch" }, { status: 400 });
		}

		await db
			.delete(branches)
			.where(and(eq(branches.repoId, repoId), eq(branches.name, name)));

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error deleting branch:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
