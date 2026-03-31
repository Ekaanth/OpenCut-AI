import { db } from "@/lib/db";
import {
	branches,
	branchPermissions,
	projectRepositories,
} from "./schema-version-control";
import { eq, and } from "drizzle-orm";

/**
 * Check if a user can push to a specific branch.
 * Returns { allowed, reason }.
 */
export async function checkBranchPushPermission(
	repoId: string,
	branchName: string,
	userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
	// Get repo — check if user is owner
	const repos = await db
		.select()
		.from(projectRepositories)
		.where(eq(projectRepositories.id, repoId))
		.limit(1);

	if (repos.length === 0) {
		return { allowed: false, reason: "Repository not found" };
	}

	const repo = repos[0];

	// Repo owner always has access
	if (repo.userId === userId) {
		return { allowed: true };
	}

	// Get the branch
	const branchResults = await db
		.select()
		.from(branches)
		.where(and(eq(branches.repoId, repoId), eq(branches.name, branchName)))
		.limit(1);

	if (branchResults.length === 0) {
		return { allowed: false, reason: "Branch not found" };
	}

	const branch = branchResults[0];

	// Protected branches require explicit write permission
	if (branch.isProtected) {
		const perms = await db
			.select()
			.from(branchPermissions)
			.where(
				and(
					eq(branchPermissions.branchId, branch.id),
					eq(branchPermissions.userId, userId),
				),
			)
			.limit(1);

		if (perms.length === 0) {
			return {
				allowed: false,
				reason: `Branch "${branchName}" is protected. Merge required.`,
			};
		}

		const perm = perms[0];
		if (perm.permission === "read") {
			return {
				allowed: false,
				reason: `You only have read access to "${branchName}"`,
			};
		}

		return { allowed: true };
	}

	// For public repos, anyone can push to non-protected branches
	if (repo.isPublic) {
		return { allowed: true };
	}

	// For private repos, check if user has any permission
	const perms = await db
		.select()
		.from(branchPermissions)
		.where(eq(branchPermissions.userId, userId))
		.limit(1);

	if (perms.length === 0) {
		return { allowed: false, reason: "No access to this repository" };
	}

	return { allowed: true };
}

/**
 * Check if a repo is visible to a user.
 */
export async function checkRepoAccess(
	repoId: string,
	userId: string,
): Promise<boolean> {
	const repos = await db
		.select()
		.from(projectRepositories)
		.where(eq(projectRepositories.id, repoId))
		.limit(1);

	if (repos.length === 0) return false;

	const repo = repos[0];
	if (repo.isPublic) return true;
	if (repo.userId === userId) return true;

	// Check if user has any branch permission in this repo
	const branchList = await db
		.select({ id: branches.id })
		.from(branches)
		.where(eq(branches.repoId, repoId))
		.limit(1);

	if (branchList.length === 0) return false;

	const perms = await db
		.select()
		.from(branchPermissions)
		.where(
			and(
				eq(branchPermissions.branchId, branchList[0].id),
				eq(branchPermissions.userId, userId),
			),
		)
		.limit(1);

	return perms.length > 0;
}
