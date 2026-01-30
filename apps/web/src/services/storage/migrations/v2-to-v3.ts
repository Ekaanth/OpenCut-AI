import { getProjectDurationFromScenes } from "@/lib/scenes";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { TScene } from "@/types/timeline";
import { StorageMigration } from "./base";

type ProjectRecord = Record<string, unknown>;

export class V2toV3Migration extends StorageMigration {
	from = 2;
	to = 3;

	async run(): Promise<void> {
		const projectsAdapter = new IndexedDBAdapter<unknown>(
			"video-editor-projects",
			"projects",
			1,
		);
		const projects = await projectsAdapter.getAll();

		for (const project of projects) {
			if (!isRecord(project)) {
				continue;
			}

			const projectId = getProjectId({ project });
			if (!projectId) {
				continue;
			}

			if (isV3Project({ project })) {
				continue;
			}

			const scenes = getScenes({ project });
			const duration = getProjectDurationFromScenes({ scenes });

			const metadataValue = project.metadata;
			const metadata = isRecord(metadataValue)
				? { ...metadataValue, duration }
				: { duration };

			const migratedProject = {
				...project,
				metadata,
				version: 3,
			};

			await projectsAdapter.set(projectId, migratedProject);
		}
	}
}

function getProjectId({ project }: { project: ProjectRecord }): string | null {
	const idValue = project.id;
	if (typeof idValue === "string" && idValue.length > 0) {
		return idValue;
	}

	const metadataValue = project.metadata;
	if (!isRecord(metadataValue)) {
		return null;
	}

	const metadataId = metadataValue.id;
	if (typeof metadataId === "string" && metadataId.length > 0) {
		return metadataId;
	}

	return null;
}

function getScenes({ project }: { project: ProjectRecord }): TScene[] {
	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) {
		return [];
	}

	return scenesValue.filter(isRecord) as unknown as TScene[];
}

function isV3Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	if (typeof versionValue === "number" && versionValue >= 3) {
		return true;
	}

	return isRecord(project.metadata) && typeof project.metadata.duration === "number";
}

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
