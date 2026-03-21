"use client";

import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useTranscription } from "@/hooks/use-transcription";
import { useAIStatus } from "@/hooks/use-ai-status";
import { getElementsAtTime, hasMediaId } from "@/lib/timeline";
import {
	computeSplitPointsFromSegments,
	type TimeRange,
} from "@/lib/text-timeline-sync";
import type { TranscriptWord } from "@/components/editor/ai/transcription-panel";
import type { TimelineElement } from "@/types/timeline";
import { toast } from "sonner";

/**
 * Bridges text-based editing operations to the actual video timeline.
 *
 * When a user deletes text segments, marks words for removal, or reorders
 * paragraphs in the transcription panel, this hook translates those
 * operations into timeline splits and deletions via EditorCore.
 */
export function useTextTimelineBridge() {
	const editor = useEditor();
	const { transcribeVideo, isTranscribing, progress, error } =
		useTranscription();
	const { isConnected } = useAIStatus();

	const segments = useTranscriptStore((s) => s.segments);

	/**
	 * Split the video timeline at each transcription segment boundary
	 * so every segment maps to its own clip on the timeline.
	 */
	const splitTimelineAtSegmentBoundaries = useCallback(
		(segments: { start: number; end: number }[]) => {
			const splitPoints = computeSplitPointsFromSegments(
				segments as { id: number; text: string; start: number; end: number; words: [] }[],
			);

			if (splitPoints.length === 0) return;

			// Split from latest to earliest so earlier indices stay valid
			const sorted = [...splitPoints].sort((a, b) => b - a);

			for (const time of sorted) {
				const elementsAtTime = getElementsAtTime({
					tracks: editor.timeline.getTracks(),
					time,
				});

				if (elementsAtTime.length > 0) {
					editor.timeline.splitElements({
						elements: elementsAtTime,
						splitTime: time,
					});
				}
			}
		},
		[editor],
	);

	/**
	 * Compact all tracks so elements are packed sequentially with no gaps.
	 * Each track is compacted independently — elements are shifted left
	 * to close any space between them.
	 */
	const compactTimeline = useCallback(() => {
		const tracks = editor.timeline.getTracks();
		const updates: Array<{
			trackId: string;
			elementId: string;
			updates: Partial<TimelineElement>;
		}> = [];

		for (const track of tracks) {
			const sorted = [...track.elements].sort(
				(a, b) => a.startTime - b.startTime,
			);
			let cursor = sorted[0]?.startTime ?? 0;
			// Start from 0 if the first element doesn't start there
			if (sorted.length > 0 && cursor > 0.01) {
				cursor = 0;
			}

			for (const element of sorted) {
				if (Math.abs(element.startTime - cursor) > 0.01) {
					updates.push({
						trackId: track.id,
						elementId: element.id,
						updates: { startTime: cursor },
					});
				}
				cursor += element.duration;
			}
		}

		if (updates.length > 0) {
			editor.timeline.updateElements({ updates });
		}
	}, [editor]);

	/**
	 * Cut time ranges from the video timeline.
	 *
	 * For each range, splits elements at the start and end boundaries,
	 * then deletes the elements that fall within the range.
	 * After all cuts, compacts the timeline to close any gaps.
	 */
	const cutTimeRanges = useCallback(
		(cuts: TimeRange[]) => {
			if (cuts.length === 0) return;

			const tracks = editor.timeline.getTracks();
			if (tracks.length === 0) return;

			// Process cuts from latest to earliest so indices don't shift
			const sortedCuts = [...cuts].sort((a, b) => b.start - a.start);

			for (const cut of sortedCuts) {
				// Find all elements that overlap with this cut range
				const elementsAtStart = getElementsAtTime({
					tracks: editor.timeline.getTracks(),
					time: cut.start,
				});

				// Split at the start boundary
				if (elementsAtStart.length > 0) {
					editor.timeline.splitElements({
						elements: elementsAtStart,
						splitTime: cut.start,
					});
				}

				// Split at the end boundary
				const elementsAtEnd = getElementsAtTime({
					tracks: editor.timeline.getTracks(),
					time: cut.end,
				});

				if (elementsAtEnd.length > 0) {
					editor.timeline.splitElements({
						elements: elementsAtEnd,
						splitTime: cut.end,
					});
				}

				// Now delete all elements that fall entirely within the cut range
				const currentTracks = editor.timeline.getTracks();
				const elementsToDelete: { trackId: string; elementId: string }[] =
					[];

				for (const track of currentTracks) {
					for (const element of track.elements) {
						// Element falls within the cut range
						if (
							element.startTime >= cut.start - 0.01 &&
							element.startTime + element.duration <= cut.end + 0.01
						) {
							elementsToDelete.push({
								trackId: track.id,
								elementId: element.id,
							});
						}
					}
				}

				if (elementsToDelete.length > 0) {
					editor.timeline.deleteElements({
						elements: elementsToDelete,
						rippleEnabled: true,
					});
				}
			}

			// Close any remaining gaps between clips
			compactTimeline();

			toast.success(
				`Cut ${cuts.length} ${cuts.length === 1 ? "section" : "sections"} from timeline`,
			);
		},
		[editor, compactTimeline],
	);

	/**
	 * After cutting and compacting, sync the transcript store segment times
	 * to match the new video clip positions on the timeline.
	 */
	const syncTranscriptTimesToTimeline = useCallback(() => {
		const segments = useTranscriptStore.getState().segments;
		if (segments.length === 0) return;

		// Find the media track (video or audio)
		const tracks = editor.timeline.getTracks();
		const mediaTrack = tracks.find(
			(t) => (t.type === "video" || t.type === "audio") && t.elements.length > 0,
		);
		if (!mediaTrack) return;

		const sortedClips = [...mediaTrack.elements].sort(
			(a, b) => a.startTime - b.startTime,
		);

		// Also find the subtitle text track
		const textTrack = tracks.find(
			(t) => t.type === "text" && t.elements.length > 0,
		);
		const sortedSubtitles = textTrack
			? [...textTrack.elements].sort((a, b) => a.startTime - b.startTime)
			: [];

		// Update transcript segments to match clip positions
		// Match by index: segment[i] corresponds to clip[i]
		const updatedSegments = segments.map((seg, i) => {
			if (i < sortedClips.length) {
				const clip = sortedClips[i];
				const newStart = clip.startTime;
				const newEnd = clip.startTime + clip.duration;
				const segDuration = newEnd - newStart;
				const wordCount = seg.words.length;
				const wordDuration = wordCount > 0 ? segDuration / wordCount : segDuration;

				return {
					...seg,
					start: newStart,
					end: newEnd,
					words: seg.words.map((w, wi) => ({
						...w,
						start: newStart + wi * wordDuration,
						end: newStart + (wi + 1) * wordDuration,
					})),
				};
			}
			return seg;
		});

		useTranscriptStore.getState().setSegments(updatedSegments);
	}, [editor]);

	/**
	 * Handle segment deletion from the transcription panel.
	 * Removes the corresponding time ranges from the video.
	 */
	const handleDeleteSegments = useCallback(
		(segmentIds: string[], cuts: TimeRange[]) => {
			cutTimeRanges(cuts);

			// Remove from transcript store
			const numericIds = segmentIds
				.map(Number)
				.filter((id) => !Number.isNaN(id));
			if (numericIds.length > 0) {
				useTranscriptStore.getState().deleteSegments(numericIds);
			}

			// Sync remaining segment times to the compacted timeline
			syncTranscriptTimesToTimeline();
		},
		[cutTimeRanges, syncTranscriptTimesToTimeline],
	);

	/**
	 * Handle word-level cuts from the transcription panel.
	 * When individual words are marked and removed, cut those
	 * tiny time ranges from the video.
	 */
	const handleCutWords = useCallback(
		(
			_segmentId: string,
			_remainingWords: TranscriptWord[],
			cuts: TimeRange[],
		) => {
			cutTimeRanges(cuts);

			// Sync remaining segment times to the compacted timeline
			syncTranscriptTimesToTimeline();
		},
		[cutTimeRanges, syncTranscriptTimesToTimeline],
	);

	/**
	 * Handle segment reordering from drag-and-drop.
	 * Rearranges the actual video clips on the timeline to match
	 * the new segment order, then updates the transcript store.
	 */
	const handleReorderSegments = useCallback(
		(
			fromIndex: number,
			toIndex: number,
			newTimings: {
				segmentId: number;
				newStart: number;
				newEnd: number;
			}[],
		) => {
			const currentSegments = useTranscriptStore.getState().segments;
			if (fromIndex === toIndex || currentSegments.length === 0) return;

			// Build a mapping from old timings to new timings
			const tracks = editor.timeline.getTracks();

			// Find video/audio tracks that have clips aligned with segments
			const mediaTrack = tracks.find(
				(t) => t.type === "video" || t.type === "audio",
			);
			if (!mediaTrack || mediaTrack.elements.length < 2) {
				// No split clips to reorder — just update transcript
				useTranscriptStore.getState().reorderSegments(fromIndex, toIndex);
				toast.info("Segments reordered in transcript");
				return;
			}

			// Sort elements by startTime so they correspond to segments in order
			const sortedElements = [...mediaTrack.elements].sort(
				(a, b) => a.startTime - b.startTime,
			);

			// Build the reordered element list
			const reordered = [...sortedElements];
			const [moved] = reordered.splice(fromIndex, 1);
			reordered.splice(toIndex, 0, moved);

			// Assign new sequential start times preserving each clip's duration
			const updates: Array<{
				trackId: string;
				elementId: string;
				updates: Partial<TimelineElement>;
			}> = [];

			let cursor = sortedElements[0]?.startTime ?? 0;
			for (const element of reordered) {
				updates.push({
					trackId: mediaTrack.id,
					elementId: element.id,
					updates: { startTime: cursor },
				});
				cursor += element.duration;
			}

			editor.timeline.updateElements({ updates });

			// Reorder in the transcript store
			useTranscriptStore.getState().reorderSegments(fromIndex, toIndex);

			toast.success("Segments reordered");
		},
		[editor],
	);

	/**
	 * Seek the video playhead to a specific time.
	 */
	const handleSeekTo = useCallback(
		(time: number) => {
			editor.playback.seek({ time });
		},
		[editor],
	);

	/**
	 * Get the current playback time.
	 */
	const getCurrentTime = useCallback((): number => {
		return editor.playback.getCurrentTime();
	}, [editor]);

	/**
	 * Start transcription for a file.
	 */
	const handleTranscribe = useCallback(async () => {
		if (!isConnected) {
			toast.error("AI backend is not connected", {
				description:
					"Start the AI backend to enable transcription. Click the AI status indicator for setup instructions.",
			});
			return;
		}

		// Find a media element with a mediaId on the timeline
		const tracks = editor.timeline.getTracks();
		let foundMediaId: string | null = null;

		for (const track of tracks) {
			for (const element of track.elements) {
				if (
					(track.type === "video" || track.type === "audio") &&
					hasMediaId(element as TimelineElement)
				) {
					foundMediaId = (element as TimelineElement & { mediaId: string }).mediaId;
					break;
				}
			}
			if (foundMediaId) break;
		}

		if (!foundMediaId) {
			toast.error("No video or audio found", {
				description:
					"Import a video or audio file first, then transcribe it.",
			});
			return;
		}

		// Look up the media asset by ID
		const mediaAsset = editor.media
			.getAssets()
			.find((asset) => asset.id === foundMediaId);

		if (!mediaAsset?.file) {
			toast.error("Cannot access media file", {
				description: "The media file could not be read for transcription.",
			});
			return;
		}

		try {
			const result = await transcribeVideo(mediaAsset.file);

			// Auto-split the video at segment boundaries so each
			// transcript segment maps to its own timeline clip
			if (result?.segments && result.segments.length > 1) {
				splitTimelineAtSegmentBoundaries(result.segments);
			}

			toast.success("Transcription complete", {
				description:
					"Your video has been split into segments. Delete or reorder segments to edit the video.",
			});
		} catch {
			// Error is already set in useTranscription hook
		}
	}, [editor, isConnected, transcribeVideo, splitTimelineAtSegmentBoundaries]);

	return {
		// Callbacks for TranscriptionPanel
		handleDeleteSegments,
		handleCutWords,
		handleReorderSegments,
		handleSeekTo,
		handleTranscribe,
		getCurrentTime,

		// State
		segments,
		isTranscribing,
		progress,
		error,
		isConnected,
	};
}
