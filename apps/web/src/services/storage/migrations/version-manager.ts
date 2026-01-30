import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";

type StorageVersionRecord = {
	version: number;
	inProgress?: {
		from: number;
		to: number;
	};
};

const DEFAULT_DB_NAME = "video-editor-meta";
const DEFAULT_STORE_NAME = "storage-version";
const DEFAULT_DB_VERSION = 1;
const STORAGE_VERSION_KEY = "storage-version";

export class StorageVersionManager {
	private adapter: IndexedDBAdapter<StorageVersionRecord>;

	constructor({
		dbName = DEFAULT_DB_NAME,
		storeName = DEFAULT_STORE_NAME,
		version = DEFAULT_DB_VERSION,
	}: {
		dbName?: string;
		storeName?: string;
		version?: number;
	} = {}) {
		this.adapter = new IndexedDBAdapter<StorageVersionRecord>(
			dbName,
			storeName,
			version,
		);
	}

	async getVersion(): Promise<number> {
		const record = await this.adapter.get(STORAGE_VERSION_KEY);
		return record?.version ?? 0;
	}

	async getVersionRecord(): Promise<StorageVersionRecord | null> {
		return this.adapter.get(STORAGE_VERSION_KEY);
	}

	async setVersion({ version }: { version: number }): Promise<void> {
		const record = await this.getVersionRecord();
		const inProgress = record?.inProgress;
		await this.adapter.set(STORAGE_VERSION_KEY, {
			version,
			...(inProgress ? { inProgress } : {}),
		});
	}

	async setInProgress({
		from,
		to,
	}: {
		from: number;
		to: number;
	}): Promise<void> {
		const record = await this.getVersionRecord();
		const version = record?.version ?? 0;
		await this.adapter.set(STORAGE_VERSION_KEY, {
			version,
			inProgress: { from, to },
		});
	}

	async clearInProgress(): Promise<void> {
		const record = await this.getVersionRecord();
		const version = record?.version ?? 0;
		await this.adapter.set(STORAGE_VERSION_KEY, { version });
	}
}
