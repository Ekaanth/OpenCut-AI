"use client";

import { useCallback, useMemo, useState } from "react";
import { useAIStore } from "@/stores/ai-store";
import { useAICommand } from "@/hooks/use-ai-command";
import { useAIStatus } from "@/hooks/use-ai-status";
import { AICommandPanel, type AIMessage } from "./ai-command-panel";
import { SmartSuggestions, type AISuggestion } from "./smart-suggestions";
import { MemoryStatusBar, type MemoryStatusInfo } from "./memory-status-bar";
import { AISetupGuide } from "./ai-setup-guide";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

export function AIPanelWrapper() {
	const {
		isCommandPanelOpen,
		isSetupGuideOpen,
		toggleCommandPanel,
		toggleSetupGuide,
		suggestions,
		dismissSuggestion,
		backendStatus,
	} = useAIStore();
	const { executeCommand, isExecuting } = useAICommand();
	const { isConnected, error: connectionError, errorType } = useAIStatus();

	const [messages, setMessages] = useState<AIMessage[]>([]);
	const [isSetupBannerDismissed, setIsSetupBannerDismissed] = useState(false);

	const handleClosePanel = useCallback(() => {
		if (isCommandPanelOpen) {
			toggleCommandPanel();
		}
	}, [isCommandPanelOpen, toggleCommandPanel]);

	const handleSendMessage = useCallback(
		async (message: string) => {
			if (!isConnected) {
				const errorMessage: AIMessage = {
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						"Cannot process commands — the AI backend is not connected. Open the setup guide from the AI status indicator in the header to get started.",
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, errorMessage]);
				return;
			}

			const userMessage: AIMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: message,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, userMessage]);

			try {
				const result = await executeCommand(message, null);

				const assistantMessage: AIMessage = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: result.explanation,
					timestamp: new Date(),
					actions: result.actions.map((action) => ({
						id: crypto.randomUUID(),
						type: action.type,
						label: action.type.replace(/_/g, " ").toLowerCase(),
						description: action.description,
						status: "pending" as const,
					})),
				};
				setMessages((prev) => [...prev, assistantMessage]);
			} catch (error) {
				const errorDetail =
					error instanceof Error ? error.message : "Unknown error";

				const isConnectionIssue =
					errorDetail.includes("Cannot connect") ||
					errorDetail.includes("timed out") ||
					errorDetail.includes("Failed to fetch");

				const errorMessage: AIMessage = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: isConnectionIssue
						? `Cannot reach the AI backend: ${errorDetail}\n\nMake sure the AI backend is running at the configured URL. Open the setup guide for instructions.`
						: `Error: ${errorDetail}\n\nThis might be a temporary issue. Try again, or check the AI backend logs for details.`,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, errorMessage]);
			}
		},
		[executeCommand, isConnected],
	);

	const handleApplyAction = useCallback(
		(messageId: string, actionId: string) => {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === messageId
						? {
								...msg,
								actions: msg.actions?.map((a) =>
									a.id === actionId
										? { ...a, status: "applied" as const }
										: a,
								),
							}
						: msg,
				),
			);
		},
		[],
	);

	const handleCancelAction = useCallback(
		(messageId: string, actionId: string) => {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === messageId
						? {
								...msg,
								actions: msg.actions?.map((a) =>
									a.id === actionId
										? { ...a, status: "cancelled" as const }
										: a,
								),
							}
						: msg,
				),
			);
		},
		[],
	);

	const smartSuggestions: AISuggestion[] = useMemo(
		() =>
			suggestions
				.filter((s) => !s.dismissed)
				.map((s) => ({
					id: s.id,
					severity: s.type,
					message: s.message,
					actionLabel: s.action
						? s.action.type.replace(/_/g, " ").toLowerCase()
						: undefined,
					timestamp: Date.now(),
				})),
		[suggestions],
	);

	const handleApplySuggestion = useCallback(
		(id: string) => {
			dismissSuggestion(id);
		},
		[dismissSuggestion],
	);

	const handleDismissSuggestion = useCallback(
		(id: string) => {
			dismissSuggestion(id);
		},
		[dismissSuggestion],
	);

	const memoryStatus: MemoryStatusInfo = useMemo(
		() => ({
			gpuUsedMb: backendStatus?.memoryUsage?.gpu?.usedMb ?? 0,
			gpuTotalMb: backendStatus?.memoryUsage?.gpu?.totalMb ?? 0,
			ramUsedMb: backendStatus?.memoryUsage?.ram?.usedMb ?? 0,
			ramTotalMb: backendStatus?.memoryUsage?.ram?.totalMb ?? 0,
		}),
		[backendStatus],
	);

	const showSetupBanner = !isConnected && !isSetupBannerDismissed;

	return (
		<>
			{/* Disconnected banner — shows at bottom of editor */}
			{showSetupBanner && (
				<div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4">
					<div
						className={cn(
							"flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg",
							"bg-background/95 backdrop-blur-sm",
							errorType === "connection_refused"
								? "border-yellow-500/30"
								: "border-red-500/30",
						)}
					>
						<div className="flex items-center justify-center size-8 rounded-full bg-yellow-500/10 shrink-0">
							<HugeiconsIcon
								icon={SparklesIcon}
								className="size-4 text-yellow-500"
							/>
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium">
								AI features are not available
							</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{errorType === "connection_refused"
									? "The AI backend is not running. Start it to enable transcription, AI commands, and more."
									: errorType === "timeout"
										? "The AI backend is not responding. It may be starting up."
										: connectionError ?? "Cannot connect to AI backend."}
							</p>
						</div>
						<div className="flex items-center gap-1.5 shrink-0">
							<Button
								size="sm"
								variant="outline"
								className="h-7 text-[11px] px-2.5"
								onClick={toggleSetupGuide}
							>
								Setup guide
							</Button>
							<Button
								size="icon"
								variant="ghost"
								className="size-6"
								onClick={() => setIsSetupBannerDismissed(true)}
							>
								<HugeiconsIcon
									icon={Cancel01Icon}
									className="size-3"
								/>
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* AI Sidebar — slides in from right, persistent */}
			<div
				className={cn(
					"fixed top-[3.4rem] right-0 bottom-0 z-30 w-80 overflow-hidden",
					"transition-transform duration-200 ease-out shadow-lg",
					isCommandPanelOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
				)}
			>
				<AICommandPanel
					isOpen={isCommandPanelOpen}
					onClose={handleClosePanel}
					messages={messages}
					onSendMessage={handleSendMessage}
					onApplyAction={handleApplyAction}
					onCancelAction={handleCancelAction}
					isProcessing={isExecuting}
				/>
			</div>

			{/* Smart Suggestions (always visible, floating) */}
			<SmartSuggestions
				suggestions={smartSuggestions}
				onApply={handleApplySuggestion}
				onDismiss={handleDismissSuggestion}
			/>

			{/* AI Setup Guide Dialog */}
			<AISetupGuide
				isOpen={isSetupGuideOpen}
				onOpenChange={(open) => {
					if (!open && isSetupGuideOpen) toggleSetupGuide();
					if (open && !isSetupGuideOpen) toggleSetupGuide();
				}}
			/>
		</>
	);
}
