import type { MediaType } from "@/types/assets";
import type {
	TProject,
	TProjectMetadata,
	TTimelineViewState,
} from "@/types/project";
import type { TScene } from "@/types/timeline";

export interface StorageAdapter<T> {
	get(key: string): Promise<T | null>;
	set(key: string, value: T): Promise<void>;
	remove(key: string): Promise<void>;
	list(): Promise<string[]>;
	clear(): Promise<void>;
}

export type ProxyResolution = "480p" | "720p" | "1080p";

export interface ProxyInfo {
	resolution: ProxyResolution;
	width: number;
	height: number;
	generatedAt: number;
	fileSize: number;
}

export const PROXY_PRESETS: Record<
	ProxyResolution,
	{ maxWidth: number; maxHeight: number }
> = {
	"480p": { maxWidth: 854, maxHeight: 480 },
	"720p": { maxWidth: 1280, maxHeight: 720 },
	"1080p": { maxWidth: 1920, maxHeight: 1080 },
};

export const PROXY_THRESHOLD_WIDTH = 1920;
export const PROXY_THRESHOLD_HEIGHT = 1080;

export interface MediaAssetData {
	id: string;
	name: string;
	type: MediaType;
	size: number;
	lastModified: number;
	width?: number;
	height?: number;
	duration?: number;
	fps?: number;
	ephemeral?: boolean;
	thumbnailUrl?: string;
	/** User-defined label for organising assets (e.g. "Drone shot", "Person A cam") */
	label?: string;
	proxy?: ProxyInfo;
	needsProxy?: boolean;
}

export type SerializedScene = Omit<TScene, "createdAt" | "updatedAt"> & {
	createdAt: string;
	updatedAt: string;
};

export type SerializedProjectMetadata = Omit<
	TProjectMetadata,
	"createdAt" | "updatedAt"
> & {
	createdAt: string;
	updatedAt: string;
};

export type SerializedProject = Omit<TProject, "metadata" | "scenes"> & {
	metadata: SerializedProjectMetadata;
	scenes: SerializedScene[];
	timelineViewState?: TTimelineViewState;
};

export interface StorageConfig {
	projectsDb: string;
	mediaDb: string;
	savedSoundsDb: string;
	version: number;
}

// TypeScript type augmentation to add async iterator methods to FileSystemDirectoryHandle
// These methods are part of the File System Access API spec but may not be in all type definitions
declare global {
	interface FileSystemDirectoryHandle {
		keys(): AsyncIterableIterator<string>;
		values(): AsyncIterableIterator<FileSystemHandle>;
		entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	}
}
