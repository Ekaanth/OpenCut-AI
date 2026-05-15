import type { EditorAction, EditorActionType } from "@/types/ai";
import { useTranscriptStore } from "@/stores/transcript-store";

function getTranscriptStore() {
	return useTranscriptStore.getState();
}

function getEditorCore() {
	const { EditorCore } = require("@/core");
	return EditorCore.getInstance();
}

export function previewAction(action: EditorAction): string {
	switch (action.type) {
		case "REMOVE_SEGMENTS": {
			const ids = action.params.segmentIds as number[] | undefined;
			const count = ids?.length ?? 0;
			return `Remove ${count} segment${count !== 1 ? "s" : ""} from the transcript`;
		}
		case "ADD_SUBTITLE_TRACK":
			return `Add subtitle track with style "${action.params.preset ?? "default"}"`;
		case "ADD_IMAGE_OVERLAY":
			return `Add image overlay at position (${action.params.x ?? 0}, ${action.params.y ?? 0})`;
		case "TRIM_CLIP": {
			const start = action.params.start as number | undefined;
			const end = action.params.end as number | undefined;
			return `Trim clip from ${start?.toFixed(2) ?? "?"}s to ${end?.toFixed(2) ?? "?"}s`;
		}
		case "ADD_TRANSITION":
			return `Add "${action.params.transitionType ?? "crossfade"}" transition`;
		case "SPLIT_CLIP": {
			const at = action.params.time as number | undefined;
			return `Split clip at ${at?.toFixed(2) ?? "?"}s`;
		}
		case "ADD_TEXT_OVERLAY":
			return `Add text overlay: "${action.params.text ?? ""}"`;
		case "ADJUST_SPEED": {
			const speed = action.params.speed as number | undefined;
			return `Adjust playback speed to ${speed ?? 1}x`;
		}
		case "ADD_VOICEOVER":
			return "Add voiceover narration";
		case "REMOVE_SILENCE": {
			const threshold = action.params.threshold as number | undefined;
			return `Remove silent segments (threshold: ${threshold ?? 0.5}s)`;
		}
		case "REMOVE_FILLERS": {
			const words = action.params.fillerWords as string[] | undefined;
			return `Remove filler words${words ? `: ${words.join(", ")}` : ""}`;
		}
		case "ADD_CHAPTER_MARKERS": {
			const count = (action.params.chapters as unknown[] | undefined)?.length;
			return `Add ${count ?? 0} chapter marker${count !== 1 ? "s" : ""}`;
		}
		case "DENOISE_AUDIO": {
			const strength = action.params.strength as number | undefined;
			return `Denoise audio (strength: ${strength ?? 0.5})`;
		}
		case "GENERATE_IMAGE":
			return `Generate image: "${action.params.prompt ?? ""}"`;
		case "SET_CANVAS_SIZE":
			return `Set canvas to ${action.params.label ?? `${action.params.width}x${action.params.height}`}`;
		case "ADD_MUSIC":
			return `Add ${action.params.genre ?? ""} music (${action.params.mood ?? ""}, ${action.params.duration ?? 30}s)`;
		case "NORMALIZE_AUDIO":
			return `Normalize audio to ${action.params.targetLUFS ?? -14} LUFS`;
		case "AUTO_DUCK":
			return `Auto-duck music under speech (${action.params.duckAmount ?? -12}dB)`;
		case "COLOR_CORRECT":
			return `Apply "${action.params.profile ?? "auto"}" color correction`;
		default:
			return action.description;
	}
}

export function executeAction(action: EditorAction): void {
	const store = getTranscriptStore();

	switch (action.type) {
		case "REMOVE_SEGMENTS": {
			const ids = action.params.segmentIds as number[] | undefined;
			if (ids && ids.length > 0) {
				store.deleteSegments(ids);
			}
			break;
		}

		case "REMOVE_FILLERS": {
			const fillerSegmentIds = store.fillers
				.filter((f) => f.isFiller)
				.map((f) => f.segmentIndex);
			const uniqueIds = [...new Set(fillerSegmentIds)];

			for (const segment of store.segments) {
				if (uniqueIds.includes(segment.id)) {
					const fillerWordsInSegment = store.fillers.filter(
						(f) => f.segmentIndex === segment.id && f.isFiller,
					);
					let cleanedText = segment.text;
					for (const filler of fillerWordsInSegment) {
						cleanedText = cleanedText.replace(
							new RegExp(`\\b${filler.word}\\b`, "gi"),
							"",
						);
					}
					cleanedText = cleanedText.replace(/\s+/g, " ").trim();
					store.updateSegment(segment.id, { text: cleanedText });
				}
			}
			break;
		}

		case "REMOVE_SILENCE": {
			const silences = store.silences;
			const segmentsToRemove = store.segments
				.filter((seg) =>
					silences.some(
						(silence) => seg.start >= silence.start && seg.end <= silence.end,
					),
				)
				.map((seg) => seg.id);

			if (segmentsToRemove.length > 0) {
				store.deleteSegments(segmentsToRemove);
			}
			break;
		}

		case "ADD_CHAPTER_MARKERS": {
			const chapters = action.params.chapters as
				| { title: string; start: number; end: number; summary?: string }[]
				| undefined;
			if (chapters) {
				store.setChapters(chapters);
			}
			break;
		}

		case "SET_CANVAS_SIZE": {
			try {
				const editor = getEditorCore();
				editor.project.updateSettings({
					settings: {
						canvasSize: {
							width: (action.params.width as number) ?? 1920,
							height: (action.params.height as number) ?? 1080,
						},
					},
					pushHistory: false,
				});
			} catch {}
			break;
		}

		case "ADD_TEXT_OVERLAY": {
			try {
				const editor = getEditorCore();
				const tracks = editor.timeline.getTracks();
				const textTrack = tracks.find((t: any) => t.type === "text");
				if (textTrack) {
					editor.timeline.insertElement({
						element: {
							type: "text",
							sourceType: "upload",
							name: (action.params.text as string) ?? "Text",
							text: (action.params.text as string) ?? "",
							startTime: 0,
							duration: 5,
							trimStart: 0,
							trimEnd: 0,
							x: (action.params.x as number) ?? 0.5,
							y: (action.params.y as number) ?? 0.5,
						} as any,
						placement: { mode: "explicit" as const, trackId: textTrack.id },
					});
				}
			} catch {}
			break;
		}

		case "SPLIT_CLIP": {
			try {
				const editor = getEditorCore();
				const time = action.params.time as number;
				if (time > 0) {
					const tracks = editor.timeline.getTracks();
					for (const track of tracks) {
						for (const el of track.elements) {
							if (time > el.startTime && time < el.startTime + el.duration) {
								editor.timeline.splitElements({
									elements: [{ trackId: track.id, elementId: el.id, time }],
								});
							}
						}
					}
				}
			} catch {}
			break;
		}

		case "ADJUST_SPEED": {
			try {
				const editor = getEditorCore();
				const speed = (action.params.speed as number) ?? 1;
				const tracks = editor.timeline.getTracks();
				const updates: Array<{
					trackId: string;
					elementId: string;
					updates: any;
				}> = [];
				for (const track of tracks) {
					for (const el of track.elements) {
						if (el.type === "video") {
							updates.push({
								trackId: track.id,
								elementId: el.id,
								updates: { playbackRate: speed },
							});
						}
					}
				}
				if (updates.length > 0) {
					editor.timeline.updateElements({ updates });
				}
			} catch {}
			break;
		}

		case "NORMALIZE_AUDIO":
		case "AUTO_DUCK":
		case "COLOR_CORRECT":
		case "ADD_SUBTITLE_TRACK":
		case "ADD_IMAGE_OVERLAY":
		case "TRIM_CLIP":
		case "ADD_TRANSITION":
		case "ADD_VOICEOVER":
		case "DENOISE_AUDIO":
		case "GENERATE_IMAGE":
		case "ADD_MUSIC":
		case "EXPORT_PROJECT":
			console.warn(
				`[ai-action-executor] Action "${action.type}" queued. Params:`,
				action.params,
			);
			break;

		default:
			console.warn(`[ai-action-executor] Unknown action type: ${action.type}`);
	}
}

export function executeActions(actions: EditorAction[]): void {
	for (const action of actions) {
		executeAction(action);
	}
}
