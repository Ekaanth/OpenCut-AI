import { useState, useCallback } from "react";
import { aiClient, AIClientError } from "@/lib/ai-client";
import { useTranscriptStore } from "@/stores/transcript-store";

function formatTranscriptionError(error: unknown): string {
	if (error instanceof AIClientError) {
		switch (error.errorType) {
			case "connection_refused":
				return "Cannot connect to AI backend. Start the backend server first (see AI Setup Guide).";
			case "timeout":
				return "Transcription request timed out. The model may still be loading — try again in a moment.";
			case "backend_error":
				return error.statusCode === 400
					? "Invalid file format. Supported: mp4, mkv, avi, mov, webm, wav, mp3, m4a, ogg, flac, aac."
					: `Backend error: ${error.message}`;
			default:
				return error.message;
		}
	}
	return error instanceof Error ? error.message : "Transcription failed";
}

export function useTranscription() {
	const [error, setError] = useState<string | null>(null);

	const {
		isTranscribing,
		progress,
		setTranscribing,
		setProgress,
		setSegments,
		setLanguage,
	} = useTranscriptStore();

	const transcribeVideo = useCallback(
		async (file: File, language?: string) => {
			setError(null);
			setTranscribing(true);
			setProgress(0);

			try {
				setProgress(10);

				const result = await aiClient.transcribe(file, language);

				setSegments(result.segments);
				setLanguage(result.language);
				setProgress(100);

				return result;
			} catch (err) {
				const message = formatTranscriptionError(err);
				setError(message);
				throw err;
			} finally {
				setTranscribing(false);
			}
		},
		[setTranscribing, setProgress, setSegments, setLanguage],
	);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	return {
		transcribeVideo,
		isTranscribing,
		progress,
		error,
		clearError,
	};
}
