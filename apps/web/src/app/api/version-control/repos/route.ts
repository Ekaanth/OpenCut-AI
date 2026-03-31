import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { projectRepositories } from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { generateUUID } from "@/utils/id";

const createRepoSchema = z.object({
	projectId: z.string().min(1),
	name: z.string().min(1),
});

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const parsed = createRepoSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: parsed.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}

		const repo = {
			id: generateUUID(),
			projectId: parsed.data.projectId,
			userId: session.user.id,
			name: parsed.data.name,
			defaultBranch: "main",
			isPublic: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await db.insert(projectRepositories).values(repo);
		return NextResponse.json(repo, { status: 201 });
	} catch (error) {
		console.error("Error creating repo:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const repos = await db
			.select()
			.from(projectRepositories)
			.where(eq(projectRepositories.userId, session.user.id));

		return NextResponse.json(repos);
	} catch (error) {
		console.error("Error listing repos:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
