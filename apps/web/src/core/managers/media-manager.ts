import type { EditorCore } from "@/core";
import type { MediaAsset } from "@/types/assets";
import { storageService } from "@/services/storage/service";
import { generateUUID } from "@/utils/id";
import { videoCache } from "@/services/video-cache/service";
import { hasMediaId } from "@/lib/timeline/element-utils";
import {
	PROXY_THRESHOLD_WIDTH,
	PROXY_THRESHOLD_HEIGHT,
	type ProxyResolution,
} from "@/services/storage/types";
import { generateProxy } from "@/services/proxy";

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();
	private proxyGenerators = new Map<string, AbortController>();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
	}): Promise<string> {
		const newAsset: MediaAsset = {
			...asset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
			this.notify();
		}

		return newAsset.id;
	}

	async updateMediaAsset({
		projectId,
		id,
		updates,
	}: {
		projectId: string;
		id: string;
		updates: Partial<Pick<MediaAsset, "label" | "name">>;
	}): Promise<void> {
		const index = this.assets.findIndex((a) => a.id === id);
		if (index === -1) return;

		const updated = { ...this.assets[index], ...updates };
		this.assets = this.assets.map((a) => (a.id === id ? updated : a));
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: updated });
		} catch (error) {
			console.error("Failed to update media asset:", error);
		}
	}

	async removeMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((asset) => asset.id === id);

		videoCache.clearVideo({ mediaId: id });

		if (asset?.url) {
			URL.revokeObjectURL(asset.url);
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
			if (asset.proxyUrl) {
				URL.revokeObjectURL(asset.proxyUrl);
			}
		}

		const controller = this.proxyGenerators.get(id);
		if (controller) {
			controller.abort();
			this.proxyGenerators.delete(id);
		}

		this.assets = this.assets.filter((asset) => asset.id !== id);
		this.notify();

		const tracks = this.editor.timeline.getTracks();
		const elementsToRemove: Array<{ trackId: string; elementId: string }> = [];

		for (const track of tracks) {
			for (const element of track.elements) {
				if (hasMediaId(element) && element.mediaId === id) {
					elementsToRemove.push({ trackId: track.id, elementId: element.id });
				}
			}
		}

		if (elementsToRemove.length > 0) {
			this.editor.timeline.deleteElements({ elements: elementsToRemove });
		}

		try {
			await storageService.deleteMediaAsset({ projectId, id });
		} catch (error) {
			console.error("Failed to delete media asset:", error);
		}
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;

			const proxyPromises = mediaAssets
				.filter((a) => a.proxy)
				.map((a) =>
					this.loadProxyForAsset({ assetId: a.id, projectId }),
				);
			await Promise.all(proxyPromises);

			this.notify();
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
			if (asset.proxyUrl) {
				URL.revokeObjectURL(asset.proxyUrl);
			}
		});

		for (const [id, controller] of this.proxyGenerators) {
			controller.abort();
		}
		this.proxyGenerators.clear();

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();

		for (const [, controller] of this.proxyGenerators) {
			controller.abort();
		}
		this.proxyGenerators.clear();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
			if (asset.proxyUrl) {
				URL.revokeObjectURL(asset.proxyUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	getAssetById(id: string): MediaAsset | undefined {
		return this.assets.find((a) => a.id === id);
	}

	needsProxy(asset: MediaAsset): boolean {
		if (asset.type !== "video") return false;
		if (!asset.width || !asset.height) return false;
		return (
			asset.width > PROXY_THRESHOLD_WIDTH ||
			asset.height > PROXY_THRESHOLD_HEIGHT
		);
	}

	isProxyGenerating(assetId: string): boolean {
		return this.proxyGenerators.has(assetId);
	}

	async generateProxyForAsset({
		assetId,
		projectId,
		resolution,
		onProgress,
	}: {
		assetId: string;
		projectId: string;
		resolution: ProxyResolution;
		onProgress?: (progress: number) => void;
	}): Promise<void> {
		const asset = this.assets.find((a) => a.id === assetId);
		if (!asset || asset.type !== "video") return;

		const existing = this.proxyGenerators.get(assetId);
		if (existing) {
			existing.abort();
			this.proxyGenerators.delete(assetId);
		}

		const controller = new AbortController();
		this.proxyGenerators.set(assetId, controller);
		this.notify();

		try {
			const result = await generateProxy({
				file: asset.file,
				resolution,
				onProgress,
				signal: controller.signal,
			});

			const proxyUrl = URL.createObjectURL(result.file);

			await storageService.saveProxyFile({
				projectId,
				assetId,
				proxyFile: result.file,
			});

			const updatedAsset: MediaAsset = {
				...asset,
				proxyFile: result.file,
				proxyUrl,
				proxy: {
					resolution,
					width: result.width,
					height: result.height,
					generatedAt: Date.now(),
					fileSize: result.file.size,
				},
			};

			this.assets = this.assets.map((a) =>
				a.id === assetId ? updatedAsset : a,
			);

			await storageService.saveMediaAsset({
				projectId,
				mediaAsset: updatedAsset,
			});

			this.notify();
		} catch (error) {
			if ((error as Error).name !== "AbortError") {
				console.error("Proxy generation failed:", error);
			}
		} finally {
			this.proxyGenerators.delete(assetId);
			this.notify();
		}
	}

	async loadProxyForAsset({
		assetId,
		projectId,
	}: {
		assetId: string;
		projectId: string;
	}): Promise<void> {
		const asset = this.assets.find((a) => a.id === assetId);
		if (!asset || !asset.proxy) return;

		try {
			const proxyFile = await storageService.loadProxyFile({
				projectId,
				assetId,
			});
			if (!proxyFile) return;

			const proxyUrl = URL.createObjectURL(proxyFile);

			this.assets = this.assets.map((a) =>
				a.id === assetId
					? { ...a, proxyFile, proxyUrl }
					: a,
			);
			this.notify();
		} catch (error) {
			console.error("Failed to load proxy:", error);
		}
	}

	async deleteProxyForAsset({
		assetId,
		projectId,
	}: {
		assetId: string;
		projectId: string;
	}): Promise<void> {
		const asset = this.assets.find((a) => a.id === assetId);
		if (!asset) return;

		const controller = this.proxyGenerators.get(assetId);
		if (controller) {
			controller.abort();
			this.proxyGenerators.delete(assetId);
		}

		if (asset.proxyUrl) {
			URL.revokeObjectURL(asset.proxyUrl);
		}

		this.assets = this.assets.map((a) =>
			a.id === assetId
				? {
						...a,
						proxyFile: undefined,
						proxyUrl: undefined,
						proxy: undefined,
					}
				: a,
		);
		this.notify();

		await storageService.deleteProxyFile({ projectId, assetId });
	}

	cancelProxyGeneration(assetId: string): void {
		const controller = this.proxyGenerators.get(assetId);
		if (controller) {
			controller.abort();
			this.proxyGenerators.delete(assetId);
			this.notify();
		}
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
