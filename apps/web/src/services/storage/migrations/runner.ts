import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { StorageMigration } from "./base";
import { StorageVersionManager } from "./version-manager";

export interface StorageMigrationResult {
	fromVersion: number;
	toVersion: number;
	migrated: boolean;
}

export type StorageMigrationCallbacks = {
	onMigrationStart?: ({
		fromVersion,
		toVersion,
	}: {
		fromVersion: number;
		toVersion: number;
	}) => void;
	onMigrationComplete?: ({
		fromVersion,
		toVersion,
	}: {
		fromVersion: number;
		toVersion: number;
	}) => void;
};

type ProjectRecord = Record<string, unknown>;

export async function runStorageMigrations({
	migrations,
	versionManager = new StorageVersionManager(),
	callbacks,
}: {
	migrations: StorageMigration[];
	versionManager?: StorageVersionManager;
	callbacks?: StorageMigrationCallbacks;
}): Promise<StorageMigrationResult> {
	const versionRecord = await versionManager.getVersionRecord();
	const inferredVersion = versionRecord
		? null
		: await inferStorageVersionFromProjects();
	const fromVersion =
		versionRecord?.inProgress?.from ??
		versionRecord?.version ??
		inferredVersion ??
		0;

	if (!versionRecord) {
		await versionManager.setVersion({ version: fromVersion });
	}

	const orderedMigrations = [...migrations].sort((a, b) => a.from - b.from);
	let currentVersion = fromVersion;

	for (const migration of orderedMigrations) {
		if (migration.from !== currentVersion) {
			continue;
		}

		await versionManager.setInProgress({
			from: migration.from,
			to: migration.to,
		});
		callbacks?.onMigrationStart?.({
			fromVersion: migration.from,
			toVersion: migration.to,
		});
		await migration.run();
		currentVersion = migration.to;
		await versionManager.setVersion({ version: currentVersion });
		await versionManager.clearInProgress();
		callbacks?.onMigrationComplete?.({
			fromVersion: migration.from,
			toVersion: migration.to,
		});
	}

	return {
		fromVersion,
		toVersion: currentVersion,
		migrated: currentVersion !== fromVersion,
	};
}

async function inferStorageVersionFromProjects(): Promise<number> {
	const projectsAdapter = new IndexedDBAdapter<unknown>(
		"video-editor-projects",
		"projects",
		1,
	);
	const projects = await projectsAdapter.getAll();

	if (projects.length === 0) {
		return 0;
	}

	let lowestVersion = Number.POSITIVE_INFINITY;

	for (const project of projects) {
		const projectVersion = checkProjectVersion({ project });
		if (projectVersion < lowestVersion) {
			lowestVersion = projectVersion;
		}
	}

	if (lowestVersion === Number.POSITIVE_INFINITY) {
		return 0;
	}

	return lowestVersion;
}

function checkProjectVersion({ project }: { project: unknown }): number {
	if (!isRecord(project)) {
		return 0;
	}

	const versionValue = project.version;

	// v2 and up
	if (typeof versionValue === "number") {
		return versionValue;
	}

	// v1 (got scenes)
	const scenesValue = project.scenes;
	if (Array.isArray(scenesValue) && scenesValue.length > 0) {
		return 1;
	}

	// v0 (didn't have scenes)
	return 0;
}

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
