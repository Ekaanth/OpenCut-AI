CREATE TABLE "vc_branch_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "branch_perm_unique" UNIQUE("branch_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "vc_branch_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_branches" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"name" text NOT NULL,
	"head_commit_id" text NOT NULL,
	"description" text,
	"color" text,
	"created_from_branch" text,
	"created_from_commit_id" text,
	"is_protected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "branch_repo_name_unique" UNIQUE("repo_id","name")
);
--> statement-breakpoint
ALTER TABLE "vc_branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_commit_media_refs" (
	"commit_id" text NOT NULL,
	"media_hash" text NOT NULL,
	"media_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vc_commit_media_refs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"parent_id" text,
	"merge_parent_id" text,
	"hash" text NOT NULL,
	"message" text NOT NULL,
	"author_id" text,
	"author_name" text,
	"author_avatar" text,
	"is_keyframe" boolean DEFAULT false NOT NULL,
	"snapshot_data" jsonb,
	"delta_data" jsonb,
	"keyframe_ancestor_id" text,
	"thumbnail_url" text,
	"duration" real DEFAULT 0 NOT NULL,
	"track_count" integer DEFAULT 0 NOT NULL,
	"element_count" integer DEFAULT 0 NOT NULL,
	"change_summary" jsonb,
	"is_auto_commit" boolean DEFAULT false,
	"merge_source_branch" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vc_commits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_media_objects" (
	"hash" text PRIMARY KEY NOT NULL,
	"size" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"storage_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"duration" real,
	"uploaded_by" text,
	"uploaded_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vc_media_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"forked_from_id" text,
	"forked_from_commit_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_repositories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"share_link_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"time_seconds" real NOT NULL,
	"timeline_track_id" text,
	"timeline_element_id" text,
	"body" text NOT NULL,
	"author_name" text NOT NULL,
	"parent_id" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"commit_id" text NOT NULL,
	"token" text NOT NULL,
	"password_hash" text,
	"allow_download" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_stashes" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"message" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vc_stashes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vc_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"commit_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "tag_repo_name_unique" UNIQUE("repo_id","name")
);
--> statement-breakpoint
ALTER TABLE "vc_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waitlist" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "vc_branch_permissions" ADD CONSTRAINT "vc_branch_permissions_branch_id_vc_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."vc_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_branch_permissions" ADD CONSTRAINT "vc_branch_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_branches" ADD CONSTRAINT "vc_branches_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_branches" ADD CONSTRAINT "vc_branches_head_commit_id_vc_commits_id_fk" FOREIGN KEY ("head_commit_id") REFERENCES "public"."vc_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_commit_media_refs" ADD CONSTRAINT "vc_commit_media_refs_commit_id_vc_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."vc_commits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_commit_media_refs" ADD CONSTRAINT "vc_commit_media_refs_media_hash_vc_media_objects_hash_fk" FOREIGN KEY ("media_hash") REFERENCES "public"."vc_media_objects"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_commits" ADD CONSTRAINT "vc_commits_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_commits" ADD CONSTRAINT "vc_commits_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_media_objects" ADD CONSTRAINT "vc_media_objects_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_commit_id_vc_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."vc_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_stashes" ADD CONSTRAINT "vc_stashes_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_stashes" ADD CONSTRAINT "vc_stashes_branch_id_vc_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."vc_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_tags" ADD CONSTRAINT "vc_tags_repo_id_project_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."project_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_tags" ADD CONSTRAINT "vc_tags_commit_id_vc_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."vc_commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vc_tags" ADD CONSTRAINT "vc_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_repo_id_idx" ON "vc_branches" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "media_refs_commit_idx" ON "vc_commit_media_refs" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX "media_refs_hash_idx" ON "vc_commit_media_refs" USING btree ("media_hash");--> statement-breakpoint
CREATE INDEX "commits_repo_id_idx" ON "vc_commits" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "commits_created_at_idx" ON "vc_commits" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "commits_hash_idx" ON "vc_commits" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "commits_parent_idx" ON "vc_commits" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "repo_project_id_idx" ON "project_repositories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "repo_user_id_idx" ON "project_repositories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_comments_link_idx" ON "review_comments" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "review_comments_repo_idx" ON "review_comments" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "share_links_repo_id_idx" ON "share_links" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "stashes_repo_id_idx" ON "vc_stashes" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "tags_repo_id_idx" ON "vc_tags" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "tags_commit_id_idx" ON "vc_tags" USING btree ("commit_id");