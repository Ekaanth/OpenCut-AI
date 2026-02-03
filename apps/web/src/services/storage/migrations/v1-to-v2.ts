import {
	IndexedDBAdapter,
	deleteDatabase,
} from "@/services/storage/indexeddb-adapter";
import type { MediaAssetData } from "@/services/storage/types";
import { StorageMigration } from "./base";
import {
	getProjectId,
	transformProjectV1ToV2,
	type TransformV1ToV2Options,
} from "./transformers/v1-to-v2";

export class V1toV2Migration extends StorageMigration {
	from = 1;
	to = 2;

	async run(): Promise<void> {
		const projectsAdapter = new IndexedDBAdapter<unknown>(
			"video-editor-projects",
			"projects",
			1,
		);
		const projects = await projectsAdapter.getAll();

		for (const project of projects) {
			if (typeof project !== "object" || project === null) {
				continue;
			}

			const projectId = getProjectId({
				project: project as Record<string, unknown>,
			});
			if (!projectId) {
				continue;
			}

			const loadMediaAsset = createMediaAssetLoader({ projectId });

			const result = await transformProjectV1ToV2({
				project: project as Record<string, unknown>,
				options: { loadMediaAsset },
			});

			if (result.skipped) {
				continue;
			}

			await projectsAdapter.set(projectId, result.project);

			await cleanupLegacyTimelineDBs({ projectId, project: result.project });
		}
	}
}

function createMediaAssetLoader({
	projectId,
}: {
	projectId: string;
}): TransformV1ToV2Options["loadMediaAsset"] {
	return async ({ mediaId }: { mediaId: string }) => {
		const mediaMetadataAdapter = new IndexedDBAdapter<MediaAssetData>(
			`video-editor-media-${projectId}`,
			"media-metadata",
			1,
		);

		return mediaMetadataAdapter.get(mediaId);
	};
}

async function cleanupLegacyTimelineDBs({
	projectId,
	project,
}: {
	projectId: string;
	project: Record<string, unknown>;
}): Promise<void> {
	const scenes = project.scenes;
	if (!Array.isArray(scenes)) {
		return;
	}

	const dbNamesToDelete: string[] = [];

	for (const scene of scenes) {
		if (typeof scene !== "object" || scene === null) {
			continue;
		}

		const sceneId = scene.id;
		if (typeof sceneId === "string") {
			const sceneDbName = `video-editor-timelines-${projectId}-${sceneId}`;
			dbNamesToDelete.push(sceneDbName);
		}
	}

	const projectDbName = `video-editor-timelines-${projectId}`;
	dbNamesToDelete.push(projectDbName);

	for (const dbName of dbNamesToDelete) {
		try {
			await deleteDatabase({ dbName });
		} catch {
			// ignore errors, DB might not exist or already deleted
		}
	}
}
