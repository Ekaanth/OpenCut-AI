import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";

export function transformProjectV7ToV8({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV8Project({ project })) {
		return { project, skipped: true, reason: "already v8" };
	}

	const migratedProject = migrateProjectElements({ project });

	return {
		project: { ...migratedProject, version: 8 },
		skipped: false,
	};
}

function migrateProjectElements({
	project,
}: {
	project: ProjectRecord;
}): ProjectRecord {
	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) return project;

	let hasChanges = false;
	const migratedScenes = scenesValue.map((scene) => {
		const migrated = migrateSceneElements({ scene });
		if (migrated !== scene) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return project;
	return { ...project, scenes: migratedScenes };
}

function migrateSceneElements({ scene }: { scene: unknown }): unknown {
	if (!isRecord(scene)) return scene;

	const tracksValue = scene.tracks;
	if (!Array.isArray(tracksValue)) return scene;

	let hasChanges = false;
	const migratedTracks = tracksValue.map((track) => {
		const migrated = migrateTrackElements({ track });
		if (migrated !== track) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return scene;
	return { ...scene, tracks: migratedTracks };
}

function migrateTrackElements({ track }: { track: unknown }): unknown {
	if (!isRecord(track)) return track;

	const elementsValue = track.elements;
	if (!Array.isArray(elementsValue)) return track;

	let hasChanges = false;
	const migratedElements = elementsValue.map((element) => {
		const migrated = migrateElement({ element });
		if (migrated !== element) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return track;
	return { ...track, elements: migratedElements };
}

function migrateElement({ element }: { element: unknown }): unknown {
	if (!isRecord(element)) return element;
	if (element.type !== "video" && element.type !== "audio") return element;
	if (typeof element.sourceDuration === "number") return element;

	const trimStart = typeof element.trimStart === "number" ? element.trimStart : 0;
	const duration = typeof element.duration === "number" ? element.duration : 0;
	const trimEnd = typeof element.trimEnd === "number" ? element.trimEnd : 0;

	return {
		...element,
		sourceDuration: trimStart + duration + trimEnd,
	};
}

function isV8Project({ project }: { project: ProjectRecord }): boolean {
	return typeof project.version === "number" && project.version >= 8;
}
