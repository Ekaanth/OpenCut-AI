export interface ShareLink {
	id: string;
	repoId?: string;
	commitId: string;
	/** Public URL — contains the unguessable token */
	url: string;
	expiresAt: string | null;
	hasPassword: boolean;
	allowDownload: boolean;
	views: number;
	revoked: boolean;
	createdAt: string;
	commentCount?: number;
	unresolvedCount?: number;
}

export interface ShareConfig {
	expiration: "1h" | "24h" | "7d" | "30d" | "never";
	password?: string;
	allowDownload: boolean;
}

export const DEFAULT_SHARE_CONFIG: ShareConfig = {
	expiration: "7d",
	allowDownload: false,
};

/** Shape returned by the public GET /api/sharing/[token]/project endpoint. */
export interface SharedProjectPayload {
	link: {
		commitId: string;
		commitMessage: string;
		allowDownload: boolean;
		expiresAt: string | null;
		projectName: string;
	};
	/** The pinned commit's serialized snapshot */
	snapshot: unknown;
	/** mediaId → media hash for every media object referenced by the commit */
	media: Record<string, string>;
}

export interface ReviewComment {
	id: string;
	shareLinkId: string;
	timeSeconds: number;
	timelineTrackId: string | null;
	timelineElementId: string | null;
	body: string;
	authorName: string;
	parentId: string | null;
	resolved: boolean;
	createdAt: number;
}
