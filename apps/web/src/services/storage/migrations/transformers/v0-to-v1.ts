import { buildDefaultScene } from "@/lib/scenes";
import type { SerializedScene } from "@/services/storage/types";
import type { TScene } from "@/types/timeline";
import type { MigrationResult, ProjectRecord } from "./types";

export interface TransformV0ToV1Options {
	now?: Date;
}

export function transformProjectV0ToV1({
	project,
	options = {},
}: {
	project: ProjectRecord;
	options?: TransformV0ToV1Options;
}): MigrationResult<ProjectRecord> {
	const { now = new Date() } = options;

	const scenesValue = project.scenes;
	if (Array.isArray(scenesValue) && scenesValue.length > 0) {
		return { project, skipped: true, reason: "already has scenes" };
	}

	const mainScene = buildDefaultScene({ isMain: true, name: "Main scene" });
	const serializedScene = serializeScene({ scene: mainScene });
	const updatedProject: ProjectRecord = {
		...project,
		scenes: [serializedScene],
		currentSceneId: mainScene.id,
		version: 1,
	};

	const updatedAt = now.toISOString();
	if (isRecord(project.metadata)) {
		updatedProject.metadata = {
			...project.metadata,
			updatedAt,
		};
	} else {
		updatedProject.updatedAt = updatedAt;
	}

	return { project: updatedProject, skipped: false };
}

export function getProjectId({
	project,
}: {
	project: ProjectRecord;
}): string | null {
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

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
