"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useAIStatus } from "@/hooks/use-ai-status";
import { toast } from "sonner";

/**
 * Watches for video/audio elements on the timeline and prompts
 * the user to transcribe if they haven't already.
 *
 * Only shows the prompt once per session.
 */
export function useTranscribePrompt() {
	const editor = useEditor();
	const { isConnected } = useAIStatus();
	const hasPrompted = useRef(false);
	const segments = useTranscriptStore((s) => s.segments);
	const isTranscribing = useTranscriptStore((s) => s.isTranscribing);

	useEffect(() => {
		if (hasPrompted.current) return;
		if (segments.length > 0 || isTranscribing) return;
		if (!isConnected) return;

		const tracks = editor.timeline.getTracks();
		const hasMedia = tracks.some(
			(track) =>
				(track.type === "video" || track.type === "audio") &&
				track.elements.length > 0,
		);

		if (hasMedia) {
			hasPrompted.current = true;
			toast("Video detected — want to transcribe it?", {
				description:
					"Transcribe your video to edit it like a text document. Delete sentences, remove filler words, reorder sections.",
				duration: 10000,
				action: {
					label: "Transcribe",
					onClick: () => {
						// Trigger via the AI toolbar — user clicks the mic button
						toast.info(
							"Click the microphone button in the toolbar to start transcription.",
						);
					},
				},
			});
		}
	}, [editor, isConnected, segments.length, isTranscribing]);
}
