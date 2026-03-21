"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
	ArrowUp01Icon,
	Cancel01Icon,
	Tick01Icon,
	SparklesIcon,
	SentIcon,
	Bookmark01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAIStore } from "@/stores/ai-store";

// ----- Types -----

export interface AIMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
	actions?: AIActionPreview[];
}

export interface AIActionPreview {
	id: string;
	type: string;
	label: string;
	description: string;
	status: "pending" | "applied" | "cancelled";
}

interface SuggestedCommand {
	label: string;
	prompt: string;
	icon?: React.ReactNode;
}

const DEFAULT_SUGGESTIONS: SuggestedCommand[] = [
	{
		label: "Remove filler words",
		prompt: "Remove all filler words like um, uh, like from the transcript",
	},
	{
		label: "Add subtitles",
		prompt: "Generate subtitles for the current video",
	},
	{
		label: "Remove silences",
		prompt: "Detect and remove long silences from the timeline",
	},
	{
		label: "Improve audio",
		prompt: "Apply noise reduction and normalize audio levels",
	},
	{
		label: "Generate thumbnail",
		prompt: "Create a thumbnail image for this video",
	},
	{
		label: "Auto color grade",
		prompt: "Apply automatic color grading to the video clips",
	},
];

// ----- Props -----

interface AICommandPanelProps {
	isOpen: boolean;
	onClose: () => void;
	messages: AIMessage[];
	onSendMessage: (message: string) => void;
	onApplyAction: (messageId: string, actionId: string) => void;
	onCancelAction: (messageId: string, actionId: string) => void;
	isProcessing?: boolean;
	suggestions?: SuggestedCommand[];
	className?: string;
}

// ----- Component -----

export function AICommandPanel({
	isOpen,
	onClose,
	messages,
	onSendMessage,
	onApplyAction,
	onCancelAction,
	isProcessing = false,
	suggestions = DEFAULT_SUGGESTIONS,
	className,
}: AICommandPanelProps) {
	const [inputValue, setInputValue] = useState("");
	const [commandHistory, setCommandHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Keyboard shortcut: Cmd/Ctrl+K
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				if (isOpen) {
					onClose();
				}
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [isOpen, onClose]);

	// Focus input when panel opens
	useEffect(() => {
		if (isOpen) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isOpen]);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	const handleSend = useCallback(() => {
		const trimmed = inputValue.trim();
		if (!trimmed || isProcessing) return;

		setCommandHistory((prev) => [trimmed, ...prev].slice(0, 50));
		setHistoryIndex(-1);
		onSendMessage(trimmed);
		setInputValue("");
	}, [inputValue, isProcessing, onSendMessage]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			} else if (e.key === "ArrowUp" && !inputValue) {
				e.preventDefault();
				if (commandHistory.length > 0) {
					const newIndex = Math.min(
						historyIndex + 1,
						commandHistory.length - 1,
					);
					setHistoryIndex(newIndex);
					setInputValue(commandHistory[newIndex] ?? "");
				}
			} else if (e.key === "ArrowDown" && historyIndex >= 0) {
				e.preventDefault();
				const newIndex = historyIndex - 1;
				setHistoryIndex(newIndex);
				setInputValue(
					newIndex >= 0 ? (commandHistory[newIndex] ?? "") : "",
				);
			} else if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[handleSend, inputValue, commandHistory, historyIndex, onClose],
	);

	const isEmpty = messages.length === 0;

	return (
		<div
			className={cn(
				"bg-background border-l flex flex-col h-full overflow-hidden",
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<HugeiconsIcon
						icon={SparklesIcon}
						className="size-4 text-primary"
					/>
					<span className="text-sm font-medium">AI Studio</span>
					<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
						Beta
					</Badge>
				</div>
				<div className="flex items-center gap-1">
					<kbd className="text-[10px] text-muted-foreground bg-accent rounded px-1 py-0.5">
						{typeof navigator !== "undefined" &&
						/Mac/.test(navigator.userAgent)
							? "\u2318K"
							: "Ctrl+K"}
					</kbd>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						aria-label="Close AI panel"
					>
						<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
					</Button>
				</div>
			</div>

			{/* Messages */}
			<ScrollArea
				ref={scrollRef}
				className="flex-1 min-h-0 px-4 py-3"
			>
				{isEmpty ? (
					<EmptySuggestions
						suggestions={suggestions}
						onSelect={(prompt) => {
							setInputValue(prompt);
							inputRef.current?.focus();
						}}
					/>
				) : (
					<div className="flex flex-col gap-3">
						{messages.map((msg) => (
							<MessageBubble
								key={msg.id}
								message={msg}
								onApplyAction={onApplyAction}
								onCancelAction={onCancelAction}
							/>
						))}
						{isProcessing && (
							<div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
								<Spinner className="size-3" />
								<span>Thinking...</span>
							</div>
						)}
					</div>
				)}
			</ScrollArea>

			{/* Input — always at bottom */}
			<div className="border-t px-3 py-2.5 bg-background shrink-0">
				<div className="relative flex items-center">
					<Input
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask anything..."
						disabled={isProcessing}
						className="pr-10 text-sm"
					/>
					<Button
						variant={inputValue.trim() ? "default" : "ghost"}
						size="icon"
						onClick={handleSend}
						disabled={!inputValue.trim() || isProcessing}
						className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
						aria-label="Send message"
					>
						{isProcessing ? (
							<Spinner className="size-3.5" />
						) : (
							<HugeiconsIcon icon={SentIcon} className="size-3.5" />
						)}
					</Button>
				</div>
				<p className="text-[9px] text-muted-foreground mt-1.5 text-center">
					Press Enter to send &middot; Save responses as ideas
				</p>
			</div>
		</div>
	);
}

// ----- Sub-components -----

function EmptySuggestions({
	suggestions,
	onSelect,
}: {
	suggestions: SuggestedCommand[];
	onSelect: (prompt: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3 pt-4">
			<div className="text-center">
				<HugeiconsIcon
					icon={SparklesIcon}
					className="size-8 text-muted-foreground/50 mx-auto mb-2"
				/>
				<p className="text-sm font-medium">AI Studio</p>
				<p className="text-xs text-muted-foreground mt-1">
					Brainstorm ideas, plan your video, or run AI commands.
				</p>
			</div>
			<div className="flex flex-col gap-1.5 mt-2">
				{suggestions.map((suggestion) => (
					<button
						key={suggestion.label}
						type="button"
						onClick={() => onSelect(suggestion.prompt)}
						className="text-left text-sm px-3 py-2 rounded-md border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
					>
						{suggestion.label}
					</button>
				))}
			</div>
		</div>
	);
}

function MessageBubble({
	message,
	onApplyAction,
	onCancelAction,
}: {
	message: AIMessage;
	onApplyAction: (messageId: string, actionId: string) => void;
	onCancelAction: (messageId: string, actionId: string) => void;
}) {
	const isUser = message.role === "user";
	const saveIdea = useAIStore((s) => s.saveIdea);

	return (
		<div
			className={cn(
				"flex flex-col gap-1.5",
				isUser ? "items-end" : "items-start",
			)}
		>
			<div
				className={cn(
					"max-w-[90%] rounded-lg px-3 py-2 text-sm",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-accent text-accent-foreground",
				)}
			>
				{message.content}
			</div>
			{!isUser && (
				<Button
					variant="ghost"
					size="sm"
					className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
					onClick={() => saveIdea(message.content)}
				>
					<HugeiconsIcon icon={Bookmark01Icon} className="size-3" />
					Save as idea
				</Button>
			)}

			{message.actions && message.actions.length > 0 && (
				<div className="flex flex-col gap-1.5 w-full max-w-[90%]">
					{message.actions.map((action) => (
						<ActionPreviewCard
							key={action.id}
							action={action}
							onApply={() => onApplyAction(message.id, action.id)}
							onCancel={() => onCancelAction(message.id, action.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ActionPreviewCard({
	action,
	onApply,
	onCancel,
}: {
	action: AIActionPreview;
	onApply: () => void;
	onCancel: () => void;
}) {
	const isResolved = action.status !== "pending";

	return (
		<Card className="rounded-lg overflow-hidden">
			<CardContent className="p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<p className="text-xs font-medium truncate">{action.label}</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							{action.description}
						</p>
					</div>
					<Badge
						variant={
							action.status === "applied"
								? "default"
								: action.status === "cancelled"
									? "secondary"
									: "outline"
						}
						className="text-[10px] shrink-0"
					>
						{action.status === "applied"
							? "Applied"
							: action.status === "cancelled"
								? "Skipped"
								: action.type}
					</Badge>
				</div>

				{!isResolved && (
					<div className="flex items-center gap-2 mt-2">
						<Button
							variant="default"
							size="sm"
							onClick={onApply}
							className="flex-1 h-6 text-xs"
						>
							<HugeiconsIcon icon={Tick01Icon} className="size-3 mr-1" />
							Apply
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={onCancel}
							className="flex-1 h-6 text-xs"
						>
							<HugeiconsIcon icon={Cancel01Icon} className="size-3 mr-1" />
							Cancel
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
