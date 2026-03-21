import { useState, useCallback } from "react";
import { aiClient, AIClientError } from "@/lib/ai-client";
import { useAIStore } from "@/stores/ai-store";
import type { CommandResult } from "@/types/ai";

function formatCommandError(error: unknown): string {
	if (error instanceof AIClientError) {
		switch (error.errorType) {
			case "connection_refused":
				return "Cannot connect to AI backend. The server needs to be running for AI commands to work.";
			case "timeout":
				return "Command timed out. The LLM may still be loading — try again in a moment.";
			case "backend_error":
				return `AI backend error: ${error.message}. Check that Ollama is running with a model loaded.`;
			default:
				return error.message;
		}
	}
	return error instanceof Error ? error.message : "Command execution failed";
}

export function useAICommand() {
	const [isExecuting, setIsExecuting] = useState(false);
	const [result, setResult] = useState<CommandResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const addCommand = useAIStore((s) => s.addCommand);

	const executeCommand = useCallback(
		async (command: string, timelineState: unknown) => {
			setIsExecuting(true);
			setError(null);
			setResult(null);

			try {
				addCommand(command);

				const commandResult = await aiClient.executeCommand(
					command,
					timelineState,
				);

				setResult(commandResult);
				return commandResult;
			} catch (err) {
				const message = formatCommandError(err);
				setError(message);
				throw err;
			} finally {
				setIsExecuting(false);
			}
		},
		[addCommand],
	);

	const clearResult = useCallback(() => {
		setResult(null);
		setError(null);
	}, []);

	return {
		executeCommand,
		clearResult,
		isExecuting,
		result,
		error,
	};
}
