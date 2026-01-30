import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { SerializedScene } from "@/services/storage/types";
import { buildDefaultScene } from "@/lib/scenes";
import type { TScene } from "@/types/timeline";
import { StorageMigration } from "./base";

type ProjectRecord = Record<string, unknown>;

export class V0toV1Migration extends StorageMigration {
	from = 0;
	to = 1;

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

			const scenesValue = project.scenes;
			if (Array.isArray(scenesValue) && scenesValue.length > 0) {
				continue;
			}

			const mainScene = buildDefaultScene({ isMain: true, name: "Main scene" });
			const serializedScene = serializeScene({ scene: mainScene });
			const updatedProject: ProjectRecord = {
				...project,
				scenes: [serializedScene],
				currentSceneId: mainScene.id,
				version: 1,
			};

			const updatedAt = new Date().toISOString();
			if (isRecord(project.metadata)) {
				updatedProject.metadata = {
					...project.metadata,
					updatedAt,
				};
			} else {
				updatedProject.updatedAt = updatedAt;
			}

			const projectId = getProjectId({ project: updatedProject });
			if (!projectId) {
				continue;
			}

			await projectsAdapter.set(projectId, updatedProject);
		}
	}
}

function serializeScene({ scene }: { scene: TScene }): SerializedScene {
	return {
		id: scene.id,
		name: scene.name,
		isMain: scene.isMain,
		tracks: scene.tracks,
		bookmarks: scene.bookmarks,
		createdAt: scene.createdAt.toISOString(),
		updatedAt: scene.updatedAt.toISOString(),
	};
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

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
