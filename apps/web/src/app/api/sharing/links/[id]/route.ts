import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectRepositories, shareLinks } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

/** Owner: revoke a share link (soft delete — history and comments stay). */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;

		const rows = await db
			.select({ link: shareLinks, repo: projectRepositories })
			.from(shareLinks)
			.innerJoin(
				projectRepositories,
				eq(shareLinks.repoId, projectRepositories.id),
			)
			.where(eq(shareLinks.id, id))
			.limit(1);

		if (rows.length === 0 || rows[0].repo.userId !== session.user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		await db
			.update(shareLinks)
			.set({ revokedAt: new Date() })
			.where(eq(shareLinks.id, id));

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error revoking share link:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
