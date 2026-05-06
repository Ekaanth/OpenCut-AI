export interface ShareLink {
	id: string;
	url: string;
	expiresAt: number | null;
	password?: string;
	allowDownload: boolean;
	allowEdit: boolean;
	views: number;
	createdAt: number;
}

export interface ShareConfig {
	expiration: "1h" | "24h" | "7d" | "30d" | "never";
	password?: string;
	allowDownload: boolean;
	allowEdit: boolean;
}

export const DEFAULT_SHARE_CONFIG: ShareConfig = {
	expiration: "24h",
	allowDownload: true,
	allowEdit: false,
};
