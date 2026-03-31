import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { commits } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ repoId: string; commitId: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { repoId, commitId } = await params;

		const result = await db
			.select()
			.from(commits)
			.where(and(eq(commits.repoId, repoId), eq(commits.id, commitId)))
			.limit(1);

		if (result.length === 0) {
			return NextResponse.json({ error: "Commit not found" }, { status: 404 });
		}

		return NextResponse.json(result[0]);
	} catch (error) {
		console.error("Error getting commit:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
