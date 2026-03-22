import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";

/**
 * v9 → v10: Add `playbackRate` field to video and audio elements.
 * Defaults to 1.0 (normal speed).
 */
export function transformProjectV9ToV10({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (typeof project.version === "number" && project.version >= 10) {
		return { project, skipped: true, reason: "already v10" };
	}

	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) {
		return { project: { ...project, version: 10 }, skipped: false };
	}

	let hasChanges = false;
	const migratedScenes = scenesValue.map((scene) => {
		if (!isRecord(scene)) return scene;
		const tracksValue = scene.tracks;
		if (!Array.isArray(tracksValue)) return scene;

		let trackChanged = false;
		const migratedTracks = tracksValue.map((track) => {
			if (!isRecord(track)) return track;
			const trackType = track.type;
			if (trackType !== "video" && trackType !== "audio") return track;

			const elements = track.elements;
			if (!Array.isArray(elements)) return track;

			let elChanged = false;
			const migratedElements = elements.map((el) => {
				if (!isRecord(el)) return el;
				if (el.playbackRate !== undefined) return el;
				elChanged = true;
				return { ...el, playbackRate: 1.0 };
			});

			if (!elChanged) return track;
			trackChanged = true;
			return { ...track, elements: migratedElements };
		});

		if (!trackChanged) return scene;
		hasChanges = true;
		return { ...scene, tracks: migratedTracks };
	});

	return {
		project: {
			...project,
			scenes: hasChanges ? migratedScenes : scenesValue,
			version: 10,
		},
		skipped: false,
	};
}
