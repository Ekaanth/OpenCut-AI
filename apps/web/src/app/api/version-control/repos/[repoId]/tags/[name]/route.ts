import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

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
		await db
			.delete(tags)
			.where(and(eq(tags.repoId, repoId), eq(tags.name, name)));

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error deleting tag:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
