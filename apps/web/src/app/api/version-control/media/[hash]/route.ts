import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediaObjects } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ hash: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { hash } = await params;

		const result = await db
			.select()
			.from(mediaObjects)
			.where(eq(mediaObjects.hash, hash))
			.limit(1);

		if (result.length === 0) {
			return NextResponse.json({ error: "Media not found" }, { status: 404 });
		}

		// Redirect to the R2 storage URL
		return NextResponse.redirect(result[0].storageUrl);
	} catch (error) {
		console.error("Error getting media:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
