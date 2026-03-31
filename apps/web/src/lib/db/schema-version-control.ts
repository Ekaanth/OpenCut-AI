import {
	pgTable,
	text,
	timestamp,
	boolean,
	jsonb,
	real,
	integer,
	bigint,
	index,
	unique,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ─── Project Repositories ─────────────────────────────────────────────────

export const projectRepositories = pgTable(
	"project_repositories",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		defaultBranch: text("default_branch").default("main").notNull(),
		isPublic: boolean("is_public").default(false).notNull(),
		forkedFromId: text("forked_from_id"),
		forkedFromCommitId: text("forked_from_commit_id"),
		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("repo_project_id_idx").on(table.projectId),
		index("repo_user_id_idx").on(table.userId),
	],
).enableRLS();

// ─── Commits ──────────────────────────────────────────────────────────────

export const commits = pgTable(
	"vc_commits",
	{
		id: text("id").primaryKey(),
		repoId: text("repo_id")
			.notNull()
			.references(() => projectRepositories.id, { onDelete: "cascade" }),
		parentId: text("parent_id"),
		mergeParentId: text("merge_parent_id"),
		hash: text("hash").notNull(),
		message: text("message").notNull(),
		authorId: text("author_id").references(() => users.id),
		authorName: text("author_name"),
		authorAvatar: text("author_avatar"),

		// Snapshot data
		isKeyframe: boolean("is_keyframe").default(false).notNull(),
		snapshotData: jsonb("snapshot_data"),
		deltaData: jsonb("delta_data"),
		keyframeAncestorId: text("keyframe_ancestor_id"),

		// Quick metadata
		thumbnailUrl: text("thumbnail_url"),
		duration: real("duration").default(0).notNull(),
		trackCount: integer("track_count").default(0).notNull(),
		elementCount: integer("element_count").default(0).notNull(),
		changeSummary: jsonb("change_summary"),

		isAutoCommit: boolean("is_auto_commit").default(false),
		mergeSourceBranch: text("merge_source_branch"),

		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("commits_repo_id_idx").on(table.repoId),
		index("commits_created_at_idx").on(table.repoId, table.createdAt),
		index("commits_hash_idx").on(table.hash),
		index("commits_parent_idx").on(table.parentId),
	],
).enableRLS();

// ─── Branches ─────────────────────────────────────────────────────────────

export const branches = pgTable(
	"vc_branches",
	{
		id: text("id").primaryKey(),
		repoId: text("repo_id")
			.notNull()
			.references(() => projectRepositories.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		headCommitId: text("head_commit_id")
			.notNull()
			.references(() => commits.id),
		description: text("description"),
		color: text("color"),
		createdFromBranch: text("created_from_branch"),
		createdFromCommitId: text("created_from_commit_id"),
		isProtected: boolean("is_protected").default(false).notNull(),
		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		unique("branch_repo_name_unique").on(table.repoId, table.name),
		index("branches_repo_id_idx").on(table.repoId),
	],
).enableRLS();

// ─── Tags ─────────────────────────────────────────────────────────────────

export const tags = pgTable(
	"vc_tags",
	{
		id: text("id").primaryKey(),
		repoId: text("repo_id")
			.notNull()
			.references(() => projectRepositories.id, { onDelete: "cascade" }),
		commitId: text("commit_id")
			.notNull()
			.references(() => commits.id),
		name: text("name").notNull(),
		type: text("type").default("custom").notNull(),
		note: text("note"),
		createdBy: text("created_by").references(() => users.id),
		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		unique("tag_repo_name_unique").on(table.repoId, table.name),
		index("tags_repo_id_idx").on(table.repoId),
		index("tags_commit_id_idx").on(table.commitId),
	],
).enableRLS();

// ─── Stashes ──────────────────────────────────────────────────────────────

export const stashes = pgTable(
	"vc_stashes",
	{
		id: text("id").primaryKey(),
		repoId: text("repo_id")
			.notNull()
			.references(() => projectRepositories.id, { onDelete: "cascade" }),
		branchId: text("branch_id")
			.notNull()
			.references(() => branches.id),
		snapshotData: jsonb("snapshot_data").notNull(),
		message: text("message"),
		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [index("stashes_repo_id_idx").on(table.repoId)],
).enableRLS();

// ─── Media Objects (content-addressable) ──────────────────────────────────

export const mediaObjects = pgTable("vc_media_objects", {
	hash: text("hash").primaryKey(),
	size: bigint("size", { mode: "number" }).notNull(),
	mimeType: text("mime_type").notNull(),
	storageUrl: text("storage_url").notNull(),
	width: integer("width"),
	height: integer("height"),
	duration: real("duration"),
	uploadedBy: text("uploaded_by").references(() => users.id),
	uploadedAt: timestamp("uploaded_at").$defaultFn(() => new Date()).notNull(),
}).enableRLS();

// ─── Commit ↔ Media References ────────────────────────────────────────────

export const commitMediaRefs = pgTable(
	"vc_commit_media_refs",
	{
		commitId: text("commit_id")
			.notNull()
			.references(() => commits.id, { onDelete: "cascade" }),
		mediaHash: text("media_hash")
			.notNull()
			.references(() => mediaObjects.hash),
		mediaId: text("media_id").notNull(),
	},
	(table) => [
		index("media_refs_commit_idx").on(table.commitId),
		index("media_refs_hash_idx").on(table.mediaHash),
	],
).enableRLS();

// ─── Branch Permissions ───────────────────────────────────────────────────

export const branchPermissions = pgTable(
	"vc_branch_permissions",
	{
		id: text("id").primaryKey(),
		branchId: text("branch_id")
			.notNull()
			.references(() => branches.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		permission: text("permission").notNull(), // "read" | "write" | "admin"
		createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		unique("branch_perm_unique").on(table.branchId, table.userId),
	],
).enableRLS();
