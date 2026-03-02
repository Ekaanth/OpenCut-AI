import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";

export function transformProjectV8ToV9({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV9Project({ project })) {
		return { project, skipped: true, reason: "already v9" };
	}

	const migratedProject = migrateProjectTextElements({ project });

	return {
		project: { ...migratedProject, version: 9 },
		skipped: false,
	};
}

function migrateProjectTextElements({
	project,
}: {
	project: ProjectRecord;
}): ProjectRecord {
	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) return project;

	let hasChanges = false;
	const migratedScenes = scenesValue.map((scene) => {
		const migrated = migrateSceneTextElements({ scene });
		if (migrated !== scene) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return project;
	return { ...project, scenes: migratedScenes };
}

function migrateSceneTextElements({ scene }: { scene: unknown }): unknown {
	if (!isRecord(scene)) return scene;

	const tracksValue = scene.tracks;
	if (!Array.isArray(tracksValue)) return scene;

	let hasChanges = false;
	const migratedTracks = tracksValue.map((track) => {
		const migrated = migrateTrackTextElements({ track });
		if (migrated !== track) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return scene;
	return { ...scene, tracks: migratedTracks };
}

function migrateTrackTextElements({ track }: { track: unknown }): unknown {
	if (!isRecord(track)) return track;
	if (track.type !== "text") return track;

	const elementsValue = track.elements;
	if (!Array.isArray(elementsValue)) return track;

	let hasChanges = false;
	const migratedElements = elementsValue.map((element) => {
		const migrated = migrateTextElement({ element });
		if (migrated !== element) hasChanges = true;
		return migrated;
	});

	if (!hasChanges) return track;
	return { ...track, elements: migratedElements };
}

function migrateTextElement({ element }: { element: unknown }): unknown {
	if (!isRecord(element)) return element;
	if (element.type !== "text") return element;

	const bg = element.background;
	if (!isRecord(bg)) return element;
	if (typeof bg.enabled === "boolean") return element;

	const color = typeof bg.color === "string" ? bg.color : "transparent";
	const enabled = color !== "transparent";

	return {
		...element,
		background: { ...bg, enabled },
	};
}

function isV9Project({ project }: { project: ProjectRecord }): boolean {
	return typeof project.version === "number" && project.version >= 9;
}
