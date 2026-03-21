import { useEffect, useRef, useCallback, useState } from "react";
import { useTranscriptStore } from "@/stores/transcript-store";
import type { TranscriptionSegment } from "@/types/ai";

interface StreamMessage {
	type: "progress" | "segment" | "complete" | "error";
	progress?: number;
	segment?: TranscriptionSegment;
	language?: string;
	duration?: number;
	error?: string;
}

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useTranscriptionStream() {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		setTranscribing,
		setProgress,
		addSegment,
		setSegments,
		setLanguage,
	} = useTranscriptStore();

	const baseUrl =
		process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420";
	const wsUrl = baseUrl.replace(/^http/, "ws");

	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		const ws = new WebSocket(`${wsUrl}/ws/transcribe`);
		wsRef.current = ws;

		ws.onopen = () => {
			setIsConnected(true);
			setError(null);
			reconnectAttemptsRef.current = 0;
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(
					event.data as string,
				) as StreamMessage;

				switch (message.type) {
					case "progress":
						if (message.progress !== undefined) {
							setProgress(message.progress);
						}
						break;

					case "segment":
						if (message.segment) {
							addSegment(message.segment);
						}
						break;

					case "complete":
						setTranscribing(false);
						setProgress(100);
						if (message.language) {
							setLanguage(message.language);
						}
						break;

					case "error":
						setError(message.error ?? "Stream error");
						setTranscribing(false);
						break;
				}
			} catch {
				// skip malformed messages
			}
		};

		ws.onclose = () => {
			setIsConnected(false);

			if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
				reconnectAttemptsRef.current += 1;
				reconnectTimeoutRef.current = setTimeout(
					connect,
					RECONNECT_DELAY,
				);
			}
		};

		ws.onerror = () => {
			setError("WebSocket connection error");
		};
	}, [
		wsUrl,
		setTranscribing,
		setProgress,
		addSegment,
		setLanguage,
	]);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;

		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}

		setIsConnected(false);
	}, []);

	const startStreaming = useCallback(
		(file: File, language?: string) => {
			if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
				setError("WebSocket not connected");
				return;
			}

			setTranscribing(true);
			setProgress(0);
			setSegments([]);
			setError(null);

			wsRef.current.send(
				JSON.stringify({
					action: "start",
					language: language ?? "auto",
					fileName: file.name,
					fileSize: file.size,
				}),
			);

			const reader = new FileReader();
			reader.onload = () => {
				if (
					wsRef.current?.readyState === WebSocket.OPEN &&
					reader.result instanceof ArrayBuffer
				) {
					wsRef.current.send(reader.result);
				}
			};
			reader.readAsArrayBuffer(file);
		},
		[setTranscribing, setProgress, setSegments],
	);

	useEffect(() => {
		return () => {
			disconnect();
		};
	}, [disconnect]);

	return {
		connect,
		disconnect,
		startStreaming,
		isConnected,
		error,
	};
}
