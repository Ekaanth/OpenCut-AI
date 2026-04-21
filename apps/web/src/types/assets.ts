import type { MediaAssetData, ProxyInfo } from "@/services/storage/types";

export type MediaType = "image" | "video" | "audio";

export interface MediaAsset
	extends Omit<MediaAssetData, "size" | "lastModified"> {
	file: File;
	url?: string;
	proxyFile?: File;
	proxyUrl?: string;
}
