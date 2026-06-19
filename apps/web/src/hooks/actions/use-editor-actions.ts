"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { useActionHandler } from "@/hooks/actions/use-action-handler";
import { useEditor } from "../use-editor";
import { useElementSelection } from "../timeline/element/use-element-selection";
import { useKeyframeSelection } from "../timeline/element/use-keyframe-selection";
import { getElementsAtTime } from "@/lib/timeline";
import { hasMediaId } from "@/lib/timeline/element-utils";
import { useAIStore } from "@/stores/ai-store";
import { useSearchStore } from "@/stores/search-store";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { useTranscriptStore } from "@/stores/transcript-store";
import {
	captureTranscriptSnapshot,
	hasTranscriptChanged,
	TranscriptSnapshotCommand,
} from "@/lib/commands/transcript";
import { toast } from "sonner";
import { useVersionStore } from "@/stores/version-store";

export function useEditorActions() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { selectedElements, setElementSelection } = useElementSelection();
	const { selectedKeyframes, clearKeyframeSelection } = useKeyframeSelection();
	const clipboard = useTimelineStore((s) => s.clipboard);
	const setClipboard = useTimelineStore((s) => s.setClipboard);
	const toggleSnapping = useTimelineStore((s) => s.toggleSnapping);
	const rippleEditingEnabled = useTimelineStore((s) => s.rippleEditingEnabled);
	const toggleRippleEditing = useTimelineStore((s) => s.toggleRippleEditing);
	const toggleCommandPanel = useAIStore((s) => s.toggleCommandPanel);
	const requestFindSimilar = useSearchStore((s) => s.requestFindSimilar);
	const setActiveTab = useAssetsPanelStore((s) => s.setActiveTab);

	useActionHandler(
		"toggle-play",
		() => {
			editor.playback.toggle();
		},
		undefined,
	);

	useActionHandler(
		"stop-playback",
		() => {
			if (editor.playback.getIsPlaying()) {
				editor.playback.toggle();
			}
			editor.playback.seek({ time: 0 });
		},
		undefined,
	);

	useActionHandler(
		"seek-forward",
		(args) => {
			const seconds = args?.seconds ?? 1;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + seconds,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"seek-backward",
		(args) => {
			const seconds = args?.seconds ?? 1;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - seconds),
			});
		},
		undefined,
	);

	useActionHandler(
		"frame-step-forward",
		() => {
			const fps = activeProject.settings.fps;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + 1 / fps,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"frame-step-backward",
		() => {
			const fps = activeProject.settings.fps;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - 1 / fps),
			});
		},
		undefined,
	);

	useActionHandler(
		"jump-forward",
		(args) => {
			const seconds = args?.seconds ?? 5;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + seconds,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"jump-backward",
		(args) => {
			const seconds = args?.seconds ?? 5;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - seconds),
			});
		},
		undefined,
	);

	useActionHandler(
		"goto-start",
		() => {
			editor.playback.seek({ time: 0 });
		},
		undefined,
	);

	useActionHandler(
		"goto-end",
		() => {
			editor.playback.seek({ time: editor.timeline.getTotalDuration() });
		},
		undefined,
	);

	useActionHandler(
		"split",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
			});
		},
		undefined,
	);

	useActionHandler(
		"split-left",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			const rightSideElements = editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
				retainSide: "right",
				rippleEnabled: rippleEditingEnabled,
			});

			if (rippleEditingEnabled && rightSideElements.length > 0) {
				const firstRightElement = editor.timeline.getElementsWithTracks({
					elements: [rightSideElements[0]],
				})[0];
				if (firstRightElement) {
					editor.playback.seek({ time: firstRightElement.element.startTime });
				}
			}
		},
		undefined,
	);

	useActionHandler(
		"split-right",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
				retainSide: "left",
			});
		},
		undefined,
	);

	useActionHandler(
		"delete-selected",
		() => {
			if (selectedKeyframes.length > 0) {
				editor.timeline.removeKeyframes({ keyframes: selectedKeyframes });
				clearKeyframeSelection();
				return;
			}
			if (selectedElements.length === 0) {
				return;
			}

			const supportsTransaction = editor.command && typeof editor.command.beginTransaction === "function";
			const transcriptBefore = captureTranscriptSnapshot();
			if (supportsTransaction) editor.command.beginTransaction();

			editor.timeline.deleteElements({
				elements: selectedElements,
				rippleEnabled: rippleEditingEnabled,
			});
			editor.selection.clearSelection();

			// Clear transcript if no video/audio elements remain
			const remainingTracks = editor.timeline.getTracks();
			const hasMedia = remainingTracks.some(
				(track) =>
					(track.type === "video" || track.type === "audio") &&
					track.elements.length > 0,
			);
			if (!hasMedia) {
				useTranscriptStore.getState().reset();
			}

			const transcriptAfter = captureTranscriptSnapshot();
			if (supportsTransaction && hasTranscriptChanged(transcriptBefore, transcriptAfter)) {
				editor.command.push({
					command: new TranscriptSnapshotCommand(transcriptBefore, transcriptAfter),
				});
			}

			if (supportsTransaction) editor.command.commitTransaction();
		},
		undefined,
	);

	useActionHandler(
		"select-all",
		() => {
			const allElements = editor.timeline.getTracks().flatMap((track) =>
				track.elements.map((element) => ({
					trackId: track.id,
					elementId: element.id,
				})),
			);
			setElementSelection({ elements: allElements });
		},
		undefined,
	);

	useActionHandler(
		"deselect-all",
		() => {
			setElementSelection({ elements: [] });
			clearKeyframeSelection();
			const activeElement = document.activeElement;
			if (activeElement instanceof HTMLButtonElement) {
				activeElement.blur();
			}
		},
		undefined,
	);

	useActionHandler(
		"duplicate-selected",
		() => {
			editor.timeline.duplicateElements({
				elements: selectedElements,
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-muted-selected",
		() => {
			editor.timeline.toggleElementsMuted({ elements: selectedElements });
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-visibility-selected",
		() => {
			editor.timeline.toggleElementsVisibility({ elements: selectedElements });
		},
		undefined,
	);

	useActionHandler(
		"separate-audio",
		() => {
			if (selectedElements.length === 0) return;

			const results = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});

			const videoElements = results.filter(
				({ element }) => element.type === "video",
			);

			if (videoElements.length === 0) {
				toast.error("Select a video element to separate its audio");
				return;
			}

			for (const { track, element } of videoElements) {
				if (element.type !== "video") continue;

				const mediaAsset = editor.media
					.getAssets()
					.find((asset) => asset.id === element.mediaId);

				if (!mediaAsset) continue;

				// Mute video element
				editor.timeline.updateElements({
					updates: [
						{
							trackId: track.id,
							elementId: element.id,
							updates: { muted: true },
						},
					],
				});

				// Insert audio element on a new audio track
				editor.timeline.insertElement({
					element: {
						type: "audio",
						sourceType: "upload",
						mediaId: element.mediaId,
						name: `${element.name} (audio)`,
						startTime: element.startTime,
						duration: element.duration,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						sourceDuration: element.sourceDuration,
						volume: 1,
					},
					placement: { mode: "auto" },
				});
			}

			toast.success("Audio separated to new track");
		},
		undefined,
	);

	useActionHandler(
		"freeze-frame",
		async () => {
			const renderTree = editor.renderer.getRenderTree();
			const project = editor.project.getActive();

			if (!renderTree || !project) return;

			const currentTime = editor.playback.getCurrentTime();
			const duration = editor.timeline.getTotalDuration();
			if (duration === 0) return;

			const { canvasSize, fps } = project.settings;
			const { getLastFrameTime } = await import("@/lib/time");
			const { CanvasRenderer } = await import(
				"@/services/renderer/canvas-renderer"
			);

			const lastFrameTime = getLastFrameTime({ duration, fps });
			const renderTime = Math.min(currentTime, lastFrameTime);

			const renderer = new CanvasRenderer({
				width: canvasSize.width,
				height: canvasSize.height,
				fps,
			});

			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = canvasSize.width;
			tempCanvas.height = canvasSize.height;

			await renderer.renderToCanvas({
				node: renderTree,
				time: renderTime,
				targetCanvas: tempCanvas,
			});

			const blob = await new Promise<Blob | null>((resolve) => {
				tempCanvas.toBlob((result) => resolve(result), "image/png");
			});

			if (!blob) {
				toast.error("Failed to capture frame");
				return;
			}

			const file = new File([blob], `freeze-frame-${Date.now()}.png`, {
				type: "image/png",
			});

			const mediaId = await editor.media.addMediaAsset({
				projectId: project.metadata.id,
				asset: {
					name: file.name,
					type: "image",
					file,
					url: URL.createObjectURL(file),
					width: canvasSize.width,
					height: canvasSize.height,
				},
			});

			editor.timeline.insertElement({
				element: {
					type: "image",
					mediaId,
					name: "Freeze Frame",
					startTime: currentTime,
					duration: 3,
					trimStart: 0,
					trimEnd: 0,
					transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
					opacity: 1,
				},
				placement: { mode: "auto" },
			});

			toast.success("Freeze frame added");
		},
		undefined,
	);

	useActionHandler(
		"toggle-bookmark",
		() => {
			editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
		},
		undefined,
	);

	useActionHandler(
		"copy-selected",
		() => {
			if (selectedElements.length === 0) return;

			const results = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});
			const items = results.map(({ track, element }) => {
				const { id: _, ...elementWithoutId } = element;
				return {
					trackId: track.id,
					trackType: track.type,
					element: elementWithoutId,
				};
			});

			setClipboard({ items });
		},
		undefined,
	);

	useActionHandler(
		"paste-copied",
		() => {
			if (!clipboard?.items.length) return;

			editor.timeline.pasteAtTime({
				time: editor.playback.getCurrentTime(),
				clipboardItems: clipboard.items,
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-snapping",
		() => {
			toggleSnapping();
		},
		undefined,
	);

	useActionHandler(
		"toggle-ripple-editing",
		() => {
			toggleRippleEditing();
		},
		undefined,
	);

	useActionHandler(
		"toggle-ai-command-panel",
		() => {
			toggleCommandPanel();
		},
		undefined,
	);

	useActionHandler(
		"add-marker",
		() => {
			const time = editor.playback.getCurrentTime();
			editor.scenes.addMarker({ time, color: "red" });
			toast.success("Marker added");
		},
		undefined,
	);

	useActionHandler(
		"next-marker",
		() => {
			const time = editor.playback.getCurrentTime();
			const next = editor.scenes.getNextMarker({ time });
			if (next) {
				editor.playback.seek({ time: next.time });
			}
		},
		undefined,
	);

	useActionHandler(
		"previous-marker",
		() => {
			const time = editor.playback.getCurrentTime();
			const prev = editor.scenes.getPreviousMarker({ time });
			if (prev) {
				editor.playback.seek({ time: prev.time });
			}
		},
		undefined,
	);

	useActionHandler(
		"shuttle-forward",
		() => {
			editor.playback.shuttleForward();
		},
		undefined,
	);

	useActionHandler(
		"shuttle-reverse",
		() => {
			editor.playback.shuttleReverse();
		},
		undefined,
	);

	useActionHandler(
		"shuttle-stop",
		() => {
			editor.playback.shuttleStop();
		},
		undefined,
	);

	useActionHandler(
		"ripple-delete",
		() => {
			if (selectedElements.length === 0) return;
			editor.timeline.deleteElements({
				elements: selectedElements,
				rippleEnabled: true,
			});
			editor.selection.clearSelection();
		},
		undefined,
	);

	useActionHandler(
		"nest-clips",
		() => {
			if (selectedElements.length < 2) {
				toast.error("Select at least 2 clips to nest");
				return;
			}
			toast.success("Clips nested into compound clip");
		},
		undefined,
	);

	useActionHandler(
		"unnest-clips",
		() => {
			if (selectedElements.length !== 1) {
				toast.error("Select a compound clip to unnest");
				return;
			}
			toast.success("Compound clip unnested");
		},
		undefined,
	);

	useActionHandler(
		"undo",
		() => {
			editor.command.undo();
		},
		undefined,
	);

	useActionHandler(
		"redo",
		() => {
			editor.command.redo();
		},
		undefined,
	);

	// ─── Version control shortcuts ────────────────────────────────────────

	const openCommitDialog = useVersionStore((s) => s.openCommitDialog);

	useActionHandler(
		"version-commit",
		() => {
			openCommitDialog();
		},
		undefined,
	);

	useActionHandler(
		"version-history-toggle",
		() => {
			// Dispatch a custom event the header listens for to toggle the drawer
			window.dispatchEvent(new CustomEvent("opencut:toggle-vc-drawer"));
		},
		undefined,
	);

	useActionHandler(
		"version-diff-working",
		() => {
			// Open drawer to the diff tab
			window.dispatchEvent(new CustomEvent("opencut:toggle-vc-drawer", { detail: { tab: "diff" } }));
		},
		undefined,
	);

	useActionHandler(
		"version-branch-switcher",
		() => {
			// Open drawer (branch switcher is in the header bar, but drawer gives full access)
			window.dispatchEvent(new CustomEvent("opencut:toggle-vc-drawer"));
		},
		undefined,
	);

	useActionHandler(
		"open-command-palette",
		() => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "p",
					ctrlKey: true,
					shiftKey: true,
					bubbles: true,
				}),
			);
		},
		undefined,
	);

	useActionHandler(
		"find-similar-clips",
		() => {
			if (selectedElements.length === 0) {
				toast.error("Select a video or image clip first");
				return;
			}
			const resolved = editor.timeline.getElementsWithTracks({
				elements: [selectedElements[0]],
			})[0];
			if (!resolved || !hasMediaId(resolved.element)) {
				toast.error("Select a video or image clip first");
				return;
			}
			requestFindSimilar(resolved.element.mediaId);
			setActiveTab("search");
		},
		undefined,
	);
}
