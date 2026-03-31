import type { TScene, TimelineTrack, TimelineElement } from "@/types/timeline";
import type {
	TimelineDiff,
	SceneSummary,
	SceneModification,
	TrackSummary,
	TrackReorder,
	ElementSummary,
	ElementModification,
	ElementMove,
	PropertyChange,
	ChangeSummary,
	ChangeCategory,
} from "@/types/version";
import type { TProject } from "@/types/project";
import { categorizeChange, describeChange, valuesDiffer } from "./change-descriptions";

// ─── Fields to ignore during diffing ──────────────────────────────────────

const IGNORED_FIELDS = new Set([
	"updatedAt",
	"createdAt",
	"buffer", // AudioBuffer - not serializable
]);

// ─── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Compute a structured diff between two project states.
 * Returns a TimelineDiff with human-readable change descriptions.
 */
export function diffProjects(stateA: TProject, stateB: TProject): TimelineDiff {
	const scenesA = stateA.scenes;
	const scenesB = stateB.scenes;

	const aMap = new Map(scenesA.map((s) => [s.id, s]));
	const bMap = new Map(scenesB.map((s) => [s.id, s]));

	const added: SceneSummary[] = [];
	const removed: SceneSummary[] = [];
	const modified: SceneModification[] = [];

	// Find removed scenes
	for (const [id, scene] of aMap) {
		if (!bMap.has(id)) {
			removed.push(sceneToSummary(scene));
		}
	}

	// Find added scenes
	for (const [id, scene] of bMap) {
		if (!aMap.has(id)) {
			added.push(sceneToSummary(scene));
		}
	}

	// Find modified scenes
	for (const [id, sceneA] of aMap) {
		const sceneB = bMap.get(id);
		if (!sceneB) continue;

		const sceneMod = diffScene(sceneA, sceneB);
		if (sceneMod) {
			modified.push(sceneMod);
		}
	}

	// Also diff settings changes
	const settingsChanges = diffSettings(stateA, stateB);
	if (settingsChanges.length > 0 && modified.length === 0 && scenesA.length > 0) {
		// Attach settings changes to the first scene's modification
		modified.push({
			sceneId: scenesA[0].id,
			sceneName: scenesA[0].name,
			trackChanges: { added: [], removed: [], reordered: [] },
			elementChanges: {
				added: [],
				removed: [],
				modified: [{
					elementId: "__settings__",
					elementName: "Project Settings",
					trackId: "__settings__",
					trackName: "Settings",
					elementType: "settings",
					changes: settingsChanges,
				}],
				moved: [],
			},
		});
	}

	const changeSummary = computeChangeSummary({ scenes: { added, removed, modified }, totalChanges: 0, changeSummary: emptySummary() });
	const totalChanges = changeSummary.tracksAdded + changeSummary.tracksRemoved +
		changeSummary.elementsAdded + changeSummary.elementsRemoved +
		changeSummary.elementsModified + added.length + removed.length;

	return {
		scenes: { added, removed, modified },
		totalChanges,
		changeSummary,
	};
}

// ─── Scene Diffing ─────────────────────────────────────────────────────────

function diffScene(sceneA: TScene, sceneB: TScene): SceneModification | null {
	const tracksA = sceneA.tracks;
	const tracksB = sceneB.tracks;

	const aMap = new Map(tracksA.map((t) => [t.id, t]));
	const bMap = new Map(tracksB.map((t) => [t.id, t]));

	const addedTracks: TrackSummary[] = [];
	const removedTracks: TrackSummary[] = [];
	const reorderedTracks: TrackReorder[] = [];
	const addedElements: ElementSummary[] = [];
	const removedElements: ElementSummary[] = [];
	const modifiedElements: ElementModification[] = [];
	const movedElements: ElementMove[] = [];

	// Track additions/removals
	for (const [id, track] of aMap) {
		if (!bMap.has(id)) {
			removedTracks.push(trackToSummary(track));
		}
	}
	for (const [id, track] of bMap) {
		if (!aMap.has(id)) {
			addedTracks.push(trackToSummary(track));
		}
	}

	// Track reordering
	const aIds = tracksA.map((t) => t.id);
	const bIds = tracksB.map((t) => t.id);
	for (const id of aIds) {
		if (!bMap.has(id)) continue;
		const oldIdx = aIds.indexOf(id);
		const newIdx = bIds.indexOf(id);
		if (oldIdx !== newIdx) {
			const track = aMap.get(id)!;
			reorderedTracks.push({
				trackId: id,
				trackName: track.name,
				oldIndex: oldIdx,
				newIndex: newIdx,
			});
		}
	}

	// Element-level diffing within matching tracks
	for (const [trackId, trackA] of aMap) {
		const trackB = bMap.get(trackId);
		if (!trackB) continue;

		const elemA = getTrackElements(trackA);
		const elemB = getTrackElements(trackB);

		const elemAMap = new Map(elemA.map((e) => [e.id, e]));
		const elemBMap = new Map(elemB.map((e) => [e.id, e]));

		// Removed elements
		for (const [elemId, elem] of elemAMap) {
			if (!elemBMap.has(elemId)) {
				removedElements.push(elementToSummary(elem, trackA));
			}
		}

		// Added elements
		for (const [elemId, elem] of elemBMap) {
			if (!elemAMap.has(elemId)) {
				addedElements.push(elementToSummary(elem, trackB));
			}
		}

		// Modified elements
		for (const [elemId, elemA_item] of elemAMap) {
			const elemB_item = elemBMap.get(elemId);
			if (!elemB_item) continue;

			const changes = diffElement(elemA_item, elemB_item);
			if (changes.length > 0) {
				modifiedElements.push({
					elementId: elemId,
					elementName: elemA_item.name,
					trackId: trackA.id,
					trackName: trackA.name,
					elementType: elemA_item.type,
					changes,
				});
			}
		}
	}

	// Check for elements moved between tracks
	const allElemA = new Map<string, { elem: TimelineElement; trackId: string }>();
	const allElemB = new Map<string, { elem: TimelineElement; trackId: string }>();
	for (const track of tracksA) {
		for (const elem of getTrackElements(track)) {
			allElemA.set(elem.id, { elem, trackId: track.id });
		}
	}
	for (const track of tracksB) {
		for (const elem of getTrackElements(track)) {
			allElemB.set(elem.id, { elem, trackId: track.id });
		}
	}
	for (const [elemId, infoA] of allElemA) {
		const infoB = allElemB.get(elemId);
		if (infoB && infoA.trackId !== infoB.trackId) {
			movedElements.push({
				elementId: elemId,
				elementName: infoA.elem.name,
				fromTrackId: infoA.trackId,
				toTrackId: infoB.trackId,
			});
		}
	}

	const hasChanges =
		addedTracks.length > 0 ||
		removedTracks.length > 0 ||
		reorderedTracks.length > 0 ||
		addedElements.length > 0 ||
		removedElements.length > 0 ||
		modifiedElements.length > 0 ||
		movedElements.length > 0;

	if (!hasChanges) return null;

	return {
		sceneId: sceneA.id,
		sceneName: sceneA.name,
		trackChanges: {
			added: addedTracks,
			removed: removedTracks,
			reordered: reorderedTracks,
		},
		elementChanges: {
			added: addedElements,
			removed: removedElements,
			modified: modifiedElements,
			moved: movedElements,
		},
	};
}

// ─── Element Diffing ───────────────────────────────────────────────────────

function diffElement(
	elemA: TimelineElement,
	elemB: TimelineElement,
): PropertyChange[] {
	const changes: PropertyChange[] = [];
	diffObjectProperties(elemA, elemB, "", changes);
	return changes;
}

function diffObjectProperties(
	a: unknown,
	b: unknown,
	basePath: string,
	changes: PropertyChange[],
): void {
	if (a === b) return;

	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
		if (valuesDiffer(a, b)) {
			const path = basePath || "value";
			changes.push({
				path,
				oldValue: a,
				newValue: b,
				category: categorizeChange(path),
				humanReadable: describeChange(path, a, b),
			});
		}
		return;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		diffArrayProperties(a, b, basePath, changes);
		return;
	}

	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

	for (const key of allKeys) {
		if (IGNORED_FIELDS.has(key)) continue;
		const subPath = basePath ? `${basePath}.${key}` : key;

		if (!(key in aObj)) {
			changes.push({
				path: subPath,
				oldValue: undefined,
				newValue: bObj[key],
				category: categorizeChange(subPath),
				humanReadable: describeChange(subPath, undefined, bObj[key]),
			});
		} else if (!(key in bObj)) {
			changes.push({
				path: subPath,
				oldValue: aObj[key],
				newValue: undefined,
				category: categorizeChange(subPath),
				humanReadable: describeChange(subPath, aObj[key], undefined),
			});
		} else {
			diffObjectProperties(aObj[key], bObj[key], subPath, changes);
		}
	}
}

function diffArrayProperties(
	a: unknown[],
	b: unknown[],
	basePath: string,
	changes: PropertyChange[],
): void {
	// ID-based array diffing
	const aHasIds = a.length > 0 && typeof a[0] === "object" && a[0] !== null && "id" in (a[0] as Record<string, unknown>);
	const bHasIds = b.length > 0 && typeof b[0] === "object" && b[0] !== null && "id" in (b[0] as Record<string, unknown>);

	if (aHasIds || bHasIds) {
		const aMap = new Map<string, unknown>();
		const bMap = new Map<string, unknown>();
		for (const item of a) {
			const obj = item as Record<string, unknown>;
			if (obj?.id) aMap.set(obj.id as string, item);
		}
		for (const item of b) {
			const obj = item as Record<string, unknown>;
			if (obj?.id) bMap.set(obj.id as string, item);
		}
		for (const [id, aItem] of aMap) {
			const bItem = bMap.get(id);
			if (bItem) {
				diffObjectProperties(aItem, bItem, basePath, changes);
			}
		}
	} else {
		// Simple comparison for arrays without IDs
		if (JSON.stringify(a) !== JSON.stringify(b)) {
			changes.push({
				path: basePath,
				oldValue: a,
				newValue: b,
				category: categorizeChange(basePath),
				humanReadable: describeChange(basePath, a, b),
			});
		}
	}
}

// ─── Settings Diffing ──────────────────────────────────────────────────────

function diffSettings(stateA: TProject, stateB: TProject): PropertyChange[] {
	const changes: PropertyChange[] = [];
	const settingsA = stateA.settings;
	const settingsB = stateB.settings;

	if (JSON.stringify(settingsA) === JSON.stringify(settingsB)) return changes;

	diffObjectProperties(settingsA, settingsB, "settings", changes);
	return changes;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTrackElements(track: TimelineTrack): TimelineElement[] {
	return track.elements as TimelineElement[];
}

function sceneToSummary(scene: TScene): SceneSummary {
	return {
		sceneId: scene.id,
		sceneName: scene.name,
		trackCount: scene.tracks.length,
	};
}

function trackToSummary(track: TimelineTrack): TrackSummary {
	return {
		trackId: track.id,
		trackName: track.name,
		trackType: track.type,
		elementCount: track.elements.length,
	};
}

function elementToSummary(
	elem: TimelineElement,
	track: TimelineTrack,
): ElementSummary {
	return {
		elementId: elem.id,
		elementName: elem.name,
		trackId: track.id,
		trackName: track.name,
		elementType: elem.type,
	};
}

function emptySummary(): ChangeSummary {
	return {
		tracksAdded: 0,
		tracksRemoved: 0,
		elementsAdded: 0,
		elementsRemoved: 0,
		elementsModified: 0,
		propertiesChanged: [],
	};
}

function computeChangeSummary(diff: TimelineDiff): ChangeSummary {
	const summary = emptySummary();

	for (const scene of diff.scenes.modified) {
		summary.tracksAdded += scene.trackChanges.added.length;
		summary.tracksRemoved += scene.trackChanges.removed.length;
		summary.elementsAdded += scene.elementChanges.added.length;
		summary.elementsRemoved += scene.elementChanges.removed.length;
		summary.elementsModified += scene.elementChanges.modified.length;

		for (const mod of scene.elementChanges.modified) {
			for (const change of mod.changes) {
				if (!summary.propertiesChanged.includes(change.path)) {
					summary.propertiesChanged.push(change.path);
				}
			}
		}
	}

	// Scene-level changes contribute to structure
	summary.tracksAdded += diff.scenes.added.reduce(
		(sum, s) => sum + s.trackCount,
		0,
	);
	summary.tracksRemoved += diff.scenes.removed.reduce(
		(sum, s) => sum + s.trackCount,
		0,
	);

	return summary;
}

/**
 * Group changes by category for display in commit dialog.
 */
export function groupChangesByCategory(
	diff: TimelineDiff,
): Record<ChangeCategory, PropertyChange[]> {
	const groups: Record<ChangeCategory, PropertyChange[]> = {
		structure: [],
		content: [],
		timing: [],
		visual: [],
		audio: [],
		text: [],
	};

	for (const scene of diff.scenes.modified) {
		for (const mod of scene.elementChanges.modified) {
			for (const change of mod.changes) {
				groups[change.category].push(change);
			}
		}
	}

	return groups;
}
