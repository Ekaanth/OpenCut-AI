import { generateUUID } from "@/utils/id";
import type { SerializedScene } from "@/services/storage/types";
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

	const sceneId = generateUUID();
	const sceneCreatedAt = now.toISOString();
	const sceneUpdatedAt = now.toISOString();

	const mainScene: SerializedScene = {
		id: sceneId,
		name: "Main scene",
		isMain: true,
		tracks: [],
		bookmarks: [],
		createdAt: sceneCreatedAt,
		updatedAt: sceneUpdatedAt,
	};

	const updatedProject: ProjectRecord = {
		...project,
		scenes: [mainScene],
		currentSceneId: sceneId,
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

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
