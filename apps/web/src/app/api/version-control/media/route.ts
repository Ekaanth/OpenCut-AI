import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediaObjects } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { computeHash, uploadMedia } from "@/services/storage/cloud-media-storage";
import { eq } from "drizzle-orm";

/**
 * POST /api/version-control/media/upload
 * Upload a media file with content-addressable hashing.
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		const buffer = await file.arrayBuffer();
		const hash = await computeHash(buffer);

		// Check if already in DB (dedup)
		const existing = await db
			.select()
			.from(mediaObjects)
			.where(eq(mediaObjects.hash, hash))
			.limit(1);

		if (existing.length > 0) {
			return NextResponse.json({
				hash,
				storageUrl: existing[0].storageUrl,
				deduplicated: true,
			});
		}

		// Upload to R2
		const storageUrl = await uploadMedia(buffer, hash, file.type);

		// Record in DB
		await db.insert(mediaObjects).values({
			hash,
			size: file.size,
			mimeType: file.type,
			storageUrl,
			uploadedBy: session.user.id,
			uploadedAt: new Date(),
		});

		return NextResponse.json({ hash, storageUrl, deduplicated: false }, { status: 201 });
	} catch (error) {
		console.error("Error uploading media:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
