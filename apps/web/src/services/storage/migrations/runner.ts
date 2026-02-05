import {
	IndexedDBAdapter,
	deleteDatabase,
} from "@/services/storage/indexeddb-adapter";
import type { StorageMigration } from "./base";
import type { ProjectRecord } from "./transformers/types";
import { getProjectId } from "./transformers/utils";

export interface StorageMigrationResult {
	migratedCount: number;
}

let hasCleanedUpMetaDb = false;

export async function runStorageMigrations({
	migrations,
}: {
	migrations: StorageMigration[];
}): Promise<StorageMigrationResult> {
	// One-time cleanup: delete the old global version database
	if (!hasCleanedUpMetaDb) {
		try {
			await deleteDatabase({ dbName: "video-editor-meta" });
		} catch {
			// Ignore errors - DB might not exist
		}
		hasCleanedUpMetaDb = true;
	}

	const projectsAdapter = new IndexedDBAdapter<ProjectRecord>(
		"video-editor-projects",
		"projects",
		1,
	);
	const projects = await projectsAdapter.getAll();

	const orderedMigrations = [...migrations].sort((a, b) => a.from - b.from);
	let migratedCount = 0;

	for (const project of projects) {
		if (typeof project !== "object" || project === null) {
			continue;
		}

		let projectRecord = project as ProjectRecord;
		let currentVersion = getProjectVersion({ project: projectRecord });

		// Apply migrations sequentially until project is up to date
		for (const migration of orderedMigrations) {
			if (migration.from !== currentVersion) {
				continue;
			}

			const result = await migration.transform(projectRecord);

			if (result.skipped) {
				break; // Project is already at this version or higher
			}

			// Update project with migrated version
			const projectId = getProjectId({ project: result.project });
			if (!projectId) {
				break; // Can't save without ID
			}

			await projectsAdapter.set(projectId, result.project);
			migratedCount++;
			currentVersion = migration.to;

			// Use migrated project for next iteration
			projectRecord = result.project;
		}
	}

	return { migratedCount };
}

function getProjectVersion({ project }: { project: ProjectRecord }): number {
	const versionValue = project.version;

	// v2 and up - has explicit version field
	if (typeof versionValue === "number") {
		return versionValue;
	}

	// v1 - has scenes array
	const scenesValue = project.scenes;
	if (Array.isArray(scenesValue) && scenesValue.length > 0) {
		return 1;
	}

	// v0 - no scenes
	return 0;
}
