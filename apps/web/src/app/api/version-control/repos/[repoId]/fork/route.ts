import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	projectRepositories,
	commits,
	branches,
	tags,
} from "@/lib/db/schema-version-control";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { generateUUID } from "@/utils/id";

const forkSchema = z.object({
	newProjectId: z.string().min(1),
	name: z.string().min(1),
});

/**
 * POST /api/version-control/repos/:repoId/fork
 * Fork a repository — copy all commits, branches, and tags.
 * Media files are shared by reference (content-addressable), not duplicated.
 */
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
		const parsed = forkSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid request" }, { status: 400 });
		}

		// Get source repo
		const sourceRepos = await db
			.select()
			.from(projectRepositories)
			.where(eq(projectRepositories.id, repoId))
			.limit(1);

		if (sourceRepos.length === 0) {
			return NextResponse.json({ error: "Source repo not found" }, { status: 404 });
		}

		const sourceRepo = sourceRepos[0];

		// Create new repo
		const newRepoId = generateUUID();
		await db.insert(projectRepositories).values({
			id: newRepoId,
			projectId: parsed.data.newProjectId,
			userId: session.user.id,
			name: parsed.data.name,
			defaultBranch: sourceRepo.defaultBranch,
			isPublic: false,
			forkedFromId: repoId,
			forkedFromCommitId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// Copy all commits (they reference media by hash, no duplication needed)
		const sourceCommits = await db
			.select()
			.from(commits)
			.where(eq(commits.repoId, repoId));

		for (const commit of sourceCommits) {
			await db.insert(commits).values({
				...commit,
				repoId: newRepoId,
			}).onConflictDoNothing();
		}

		// Copy branches
		const sourceBranches = await db
			.select()
			.from(branches)
			.where(eq(branches.repoId, repoId));

		for (const branch of sourceBranches) {
			await db.insert(branches).values({
				...branch,
				id: generateUUID(),
				repoId: newRepoId,
			});
		}

		// Copy tags
		const sourceTags = await db
			.select()
			.from(tags)
			.where(eq(tags.repoId, repoId));

		for (const tag of sourceTags) {
			await db.insert(tags).values({
				...tag,
				id: generateUUID(),
				repoId: newRepoId,
			});
		}

		return NextResponse.json(
			{
				id: newRepoId,
				forkedFrom: repoId,
				commits: sourceCommits.length,
				branches: sourceBranches.length,
				tags: sourceTags.length,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error forking repo:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
