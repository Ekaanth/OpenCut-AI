import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { commitMediaRefs, mediaObjects } from "@/lib/db/schema-version-control";
import { getShareLinkByToken, checkShareGate } from "@/lib/sharing/share-server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Public: stream media for a shared commit — but only hashes that the
 * pinned commit actually references. Same redirect-to-storage behavior
 * as the authed /api/version-control/media/[hash] endpoint.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string; hash: string }> },
) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { token, hash } = await params;
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

		// The hash must belong to the pinned commit — tokens can't read arbitrary media
		const refs = await db
			.select({ mediaHash: commitMediaRefs.mediaHash })
			.from(commitMediaRefs)
			.where(eq(commitMediaRefs.commitId, link.commitId));
		if (!refs.some((ref) => ref.mediaHash === hash)) {
			return NextResponse.json({ error: "Media not found" }, { status: 404 });
		}

		const mediaRows = await db
			.select()
			.from(mediaObjects)
			.where(eq(mediaObjects.hash, hash))
			.limit(1);
		if (mediaRows.length === 0) {
			return NextResponse.json({ error: "Media not found" }, { status: 404 });
		}

		return NextResponse.redirect(mediaRows[0].storageUrl);
	} catch (error) {
		console.error("Error serving shared media:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
