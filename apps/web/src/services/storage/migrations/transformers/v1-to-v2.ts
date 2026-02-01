import {
	DEFAULT_BLUR_INTENSITY,
	DEFAULT_CANVAS_SIZE,
	DEFAULT_COLOR,
	DEFAULT_FPS,
} from "@/constants/project-constants";
import type { MigrationResult, ProjectRecord } from "./types";

export function transformProjectV1ToV2({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV2Project({ project })) {
		return { project, skipped: true, reason: "already v2" };
	}

	const migratedProject = migrateProject({ project, projectId });
	return { project: migratedProject, skipped: false };
}

function migrateProject({
	project,
	projectId,
}: {
	project: ProjectRecord;
	projectId: string;
}): ProjectRecord {
	const createdAt = normalizeDateString({ value: project.createdAt });
	const updatedAt = normalizeDateString({ value: project.updatedAt });
	const metadataValue = project.metadata;

	const metadata = isRecord(metadataValue)
		? {
				id: getStringValue({ value: metadataValue.id, fallback: projectId }),
				name: getStringValue({ value: metadataValue.name, fallback: "" }),
				thumbnail: getStringValue({ value: metadataValue.thumbnail }),
				createdAt: normalizeDateString({ value: metadataValue.createdAt }),
				updatedAt: normalizeDateString({ value: metadataValue.updatedAt }),
			}
		: {
				id: projectId,
				name: getStringValue({ value: project.name, fallback: "" }),
				thumbnail: getStringValue({ value: project.thumbnail }),
				createdAt,
				updatedAt,
			};

	const scenesValue = project.scenes;
	const scenes = Array.isArray(scenesValue) ? scenesValue : [];
	const legacyBookmarks = Array.isArray(project.bookmarks)
		? project.bookmarks
		: null;
	const normalizedScenes = applyLegacyBookmarks({
		scenes,
		legacyBookmarks,
	});

	const settingsValue = project.settings;
	const settings = isRecord(settingsValue)
		? {
				fps: getNumberValue({
					value: settingsValue.fps,
					fallback: DEFAULT_FPS,
				}),
				canvasSize: getCanvasSizeValue({
					value: settingsValue.canvasSize,
					fallback: DEFAULT_CANVAS_SIZE,
				}),
				background: getBackgroundValue({
					value: settingsValue.background,
				}),
			}
		: {
				fps: getNumberValue({ value: project.fps, fallback: DEFAULT_FPS }),
				canvasSize: getCanvasSizeValue({
					value: project.canvasSize,
					fallback: DEFAULT_CANVAS_SIZE,
				}),
				background: getBackgroundValue({
					value: project.background,
					backgroundType: project.backgroundType,
					backgroundColor: project.backgroundColor,
					blurIntensity: project.blurIntensity,
				}),
			};

	const currentSceneId = getCurrentSceneId({
		value: project.currentSceneId,
		scenes: normalizedScenes,
	});

	return {
		...project,
		metadata,
		scenes: normalizedScenes,
		currentSceneId,
		settings,
		version: 2,
	};
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

function getCurrentSceneId({
	value,
	scenes,
}: {
	value: unknown;
	scenes: unknown[];
}): string {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}

	const mainSceneId = findMainSceneId({ scenes });
	if (mainSceneId) {
		return mainSceneId;
	}

	return "";
}

function findMainSceneId({ scenes }: { scenes: unknown[] }): string | null {
	for (const scene of scenes) {
		if (!isRecord(scene)) {
			continue;
		}

		if (scene.isMain === true && typeof scene.id === "string") {
			return scene.id;
		}
	}

	for (const scene of scenes) {
		if (!isRecord(scene)) {
			continue;
		}

		if (typeof scene.id === "string") {
			return scene.id;
		}
	}

	return null;
}

function applyLegacyBookmarks({
	scenes,
	legacyBookmarks,
}: {
	scenes: unknown[];
	legacyBookmarks: unknown[] | null;
}): unknown[] {
	if (!legacyBookmarks || legacyBookmarks.length === 0) {
		return scenes;
	}

	const mainSceneId = findMainSceneId({ scenes });

	return scenes.map((scene) => {
		if (!isRecord(scene)) {
			return scene;
		}

		if (mainSceneId && scene.id !== mainSceneId) {
			return scene;
		}

		if (Array.isArray(scene.bookmarks) && scene.bookmarks.length > 0) {
			return scene;
		}

		return {
			...scene,
			bookmarks: legacyBookmarks,
		};
	});
}

function getBackgroundValue({
	value,
	backgroundType,
	backgroundColor,
	blurIntensity,
}: {
	value?: unknown;
	backgroundType?: unknown;
	backgroundColor?: unknown;
	blurIntensity?: unknown;
}): {
	type: "color" | "blur";
	color?: string;
	blurIntensity?: number;
} {
	if (isRecord(value)) {
		const typeValue = value.type;
		if (typeValue === "blur") {
			return {
				type: "blur",
				blurIntensity: getNumberValue({
					value: value.blurIntensity,
					fallback: DEFAULT_BLUR_INTENSITY,
				}),
			};
		}

		return {
			type: "color",
			color: getStringValue({ value: value.color, fallback: DEFAULT_COLOR }),
		};
	}

	if (backgroundType === "blur") {
		return {
			type: "blur",
			blurIntensity: getNumberValue({
				value: blurIntensity,
				fallback: DEFAULT_BLUR_INTENSITY,
			}),
		};
	}

	return {
		type: "color",
		color: getStringValue({ value: backgroundColor, fallback: DEFAULT_COLOR }),
	};
}

function getCanvasSizeValue({
	value,
	fallback,
}: {
	value: unknown;
	fallback: { width: number; height: number };
}): { width: number; height: number } {
	if (isRecord(value)) {
		const width = getNumberValue({
			value: value.width,
			fallback: fallback.width,
		});
		const height = getNumberValue({
			value: value.height,
			fallback: fallback.height,
		});

		return { width, height };
	}

	return fallback;
}

function getNumberValue({
	value,
	fallback,
}: {
	value: unknown;
	fallback: number;
}): number {
	return typeof value === "number" ? value : fallback;
}

function getStringValue({
	value,
	fallback,
}: {
	value: unknown;
	fallback?: string;
}): string | undefined {
	if (typeof value === "string") {
		return value;
	}

	return fallback;
}

function normalizeDateString({ value }: { value: unknown }): string {
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "string") {
		return value;
	}

	return new Date().toISOString();
}

function isV2Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	if (typeof versionValue === "number" && versionValue >= 2) {
		return true;
	}

	return isRecord(project.metadata) && isRecord(project.settings);
}

function isRecord(value: unknown): value is ProjectRecord {
	return typeof value === "object" && value !== null;
}
