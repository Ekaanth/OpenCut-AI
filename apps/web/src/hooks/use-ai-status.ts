import { useEffect, useCallback, useRef } from "react";
import { aiClient, AIClientError } from "@/lib/ai-client";
import { useAIStore } from "@/stores/ai-store";
import type { AIErrorType } from "@/types/ai";

const POLL_INTERVAL = 30_000;

function classifyError(error: unknown): { message: string; errorType: AIErrorType } {
	if (error instanceof AIClientError) {
		return { message: error.message, errorType: error.errorType };
	}
	const message = error instanceof Error ? error.message : "Unknown error";
	return { message, errorType: "unknown" };
}

export function useAIStatus() {
	const backendStatus = useAIStore((s) => s.backendStatus);
	const setBackendStatus = useAIStore((s) => s.setBackendStatus);
	const setConnectionError = useAIStore((s) => s.setConnectionError);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const checkStatus = useCallback(async () => {
		try {
			const status = await aiClient.health();
			setBackendStatus(status);
		} catch (error) {
			const { message, errorType } = classifyError(error);
			setConnectionError(message, errorType);
		}
	}, [setBackendStatus, setConnectionError]);

	useEffect(() => {
		checkStatus();

		intervalRef.current = setInterval(checkStatus, POLL_INTERVAL);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [checkStatus]);

	return {
		isConnected: backendStatus?.available ?? false,
		backendStatus,
		error: backendStatus?.error ?? null,
		errorType: backendStatus?.errorType ?? null,
		refresh: checkStatus,
	};
}
