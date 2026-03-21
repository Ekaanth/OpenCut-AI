"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	SparklesIcon,
	SentIcon,
	AiMicIcon,
	TextIcon,
	Image01Icon,
	ArrowRight01Icon,
	Bookmark01Icon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { aiClient } from "@/lib/ai-client";
import { useAIStatus } from "@/hooks/use-ai-status";
import { useAIStore, type StudioMessage } from "@/stores/ai-store";
import { useTranscriptStore } from "@/stores/transcript-store";
import { toast } from "sonner";

// ----- Types -----

interface WorkflowStep {
	id: string;
	label: string;
	description: string;
	icon: typeof SparklesIcon;
	action: string;
	isCompleted?: boolean;
}

type StudioMode = "chat" | "workflow" | "transcript";

// ----- Workflow Steps -----

const VIDEO_WORKFLOWS: {
	id: string;
	title: string;
	description: string;
	steps: WorkflowStep[];
}[] = [
	{
		id: "youtube",
		title: "YouTube video",
		description: "Plan, script, and produce a YouTube video",
		steps: [
			{
				id: "brainstorm",
				label: "Brainstorm the idea",
				description:
					"Describe your topic and audience. AI helps refine your angle.",
				icon: SparklesIcon,
				action: "brainstorm",
			},
			{
				id: "outline",
				label: "Create an outline",
				description:
					"AI generates a structured outline with key points and timestamps.",
				icon: TextIcon,
				action: "outline",
			},
			{
				id: "script",
				label: "Write the script",
				description:
					"Turn the outline into a full script with intro, body, and CTA.",
				icon: TextIcon,
				action: "script",
			},
			{
				id: "record",
				label: "Record and import",
				description:
					"Record your video following the script, then import it here.",
				icon: AiMicIcon,
				action: "import",
			},
			{
				id: "transcribe",
				label: "Transcribe and edit",
				description:
					"Transcribe the recording, then edit text to edit video.",
				icon: AiMicIcon,
				action: "transcribe",
			},
			{
				id: "polish",
				label: "Polish with AI",
				description:
					"Remove fillers, silences, add subtitles, generate thumbnail.",
				icon: Image01Icon,
				action: "polish",
			},
		],
	},
	{
		id: "short",
		title: "Short-form content",
		description: "TikTok, Reels, or YouTube Shorts",
		steps: [
			{
				id: "hook",
				label: "Craft the hook",
				description:
					"AI helps write a 3-second hook that stops the scroll.",
				icon: SparklesIcon,
				action: "hook",
			},
			{
				id: "script",
				label: "Script the content",
				description:
					"Keep it tight — AI structures your message for 30-60 seconds.",
				icon: TextIcon,
				action: "script-short",
			},
			{
				id: "record",
				label: "Record vertically",
				description:
					"Film in 9:16 portrait mode following the script.",
				icon: AiMicIcon,
				action: "import",
			},
			{
				id: "edit",
				label: "Fast-cut edit",
				description:
					"Remove silences and filler for punchy pacing.",
				icon: SparklesIcon,
				action: "fast-edit",
			},
			{
				id: "subtitles",
				label: "Add bold subtitles",
				description:
					"Most viewers watch muted — add animated captions.",
				icon: TextIcon,
				action: "subtitles",
			},
		],
	},
	{
		id: "podcast",
		title: "Podcast episode",
		description: "Record, clean, and clip a podcast",
		steps: [
			{
				id: "plan",
				label: "Plan the episode",
				description:
					"AI helps structure topics, questions, and talking points.",
				icon: SparklesIcon,
				action: "plan-podcast",
			},
			{
				id: "import",
				label: "Import recording",
				description: "Import your podcast recording.",
				icon: AiMicIcon,
				action: "import",
			},
			{
				id: "clean",
				label: "Clean the audio",
				description:
					"Remove background noise and normalize levels.",
				icon: SparklesIcon,
				action: "clean-audio",
			},
			{
				id: "transcribe",
				label: "Transcribe and find clips",
				description:
					"Transcribe to easily navigate and find the best moments.",
				icon: TextIcon,
				action: "transcribe",
			},
			{
				id: "clip",
				label: "Create highlight clips",
				description:
					"AI identifies the best segments for social media clips.",
				icon: Image01Icon,
				action: "highlights",
			},
		],
	},
];

// ----- Chat Prompts -----

const STARTER_PROMPTS = [
	{
		label: "Help me plan a YouTube video about...",
		prompt: "Help me plan a YouTube video. I want to make a video about ",
	},
	{
		label: "Write a script for a 60-second reel",
		prompt:
			"Write a script for a 60-second vertical video/reel about ",
	},
	{
		label: "Give me 5 video ideas about...",
		prompt: "Give me 5 unique video content ideas about ",
	},
	{
		label: "Help me write a video intro",
		prompt:
			"Help me write a compelling 10-second video intro for a video about ",
	},
	{
		label: "Create an outline for a tutorial",
		prompt:
			"Create a detailed outline for a tutorial video about ",
	},
	{
		label: "Suggest a thumbnail concept",
		prompt:
			"Describe a compelling thumbnail concept for a video about ",
	},
];

const TRANSCRIPT_PROMPTS = [
	{
		label: "Make it more concise",
		prompt: "Rewrite this transcript to be more concise. Remove redundant phrases and tighten the language while keeping the same meaning:\n\n",
	},
	{
		label: "Make it more professional",
		prompt: "Rewrite this transcript in a more professional and polished tone:\n\n",
	},
	{
		label: "Simplify the language",
		prompt: "Rewrite this transcript using simpler, more accessible language that a general audience can understand:\n\n",
	},
	{
		label: "Add more energy",
		prompt: "Rewrite this transcript to be more engaging and energetic, with stronger hooks and more dynamic phrasing:\n\n",
	},
	{
		label: "Fix grammar and flow",
		prompt: "Fix any grammar issues and improve the flow of this transcript while keeping the original meaning:\n\n",
	},
	{
		label: "Summarize key points",
		prompt: "Summarize the key points from this transcript in bullet points:\n\n",
	},
];

// ----- Component -----

export function AIStudioView() {
	const { isConnected } = useAIStatus();
	const toggleSetupGuide = useAIStore((s) => s.toggleSetupGuide);
	const saveIdea = useAIStore((s) => s.saveIdea);
	const messages = useAIStore((s) => s.studioMessages);
	const addMessage = useAIStore((s) => s.addStudioMessage);
	const clearMessages = useAIStore((s) => s.clearStudioMessages);
	const transcriptSegments = useTranscriptStore((s) => s.segments);
	const hasTranscript = transcriptSegments.length > 0;

	const [mode, setMode] = useState<StudioMode>("chat");
	const [inputValue, setInputValue] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(
		null,
	);
	const [completedSteps, setCompletedSteps] = useState<Set<string>>(
		new Set(),
	);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll on new messages
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isThinking]);

	const handleSend = useCallback(async () => {
		const trimmed = inputValue.trim();
		if (!trimmed || isThinking) return;

		if (!isConnected) {
			toast.error("AI backend is not connected", {
				description: "Start the AI backend to use AI Studio.",
			});
			return;
		}

		addMessage({
			id: crypto.randomUUID(),
			role: "user",
			content: trimmed,
		});
		setInputValue("");
		setIsThinking(true);

		try {
			let prompt = trimmed;
			let systemPrompt: string | undefined;

			if (mode === "transcript" && hasTranscript) {
				const fullText = transcriptSegments.map((s) => s.text).join(" ");
				systemPrompt =
					"You are a video script editor. The user has a video transcript and wants you to help edit, rewrite, or improve it. " +
					"When rewriting, preserve the key information but improve the text as requested. " +
					"Return only the improved text, not explanations.";
				// If the prompt doesn't already include the transcript, append it
				if (!prompt.includes(fullText.slice(0, 50))) {
					prompt = `${prompt}\n\nTranscript:\n${fullText}`;
				}
			}

			const result = await aiClient.chat(prompt, systemPrompt);

			addMessage({
				id: crypto.randomUUID(),
				role: "assistant",
				content:
					result.response || "Here's what I suggest based on your request.",
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : "";
			const isOllamaDown = detail.includes("503") || detail.includes("Ollama");

			addMessage({
				id: crypto.randomUUID(),
				role: "assistant",
				content: isOllamaDown
					? "Ollama is not running or no LLM model is loaded. Open the AI Setup guide (click the AI indicator in the header) to pull a model like `llama3.2:1b`."
					: `Something went wrong: ${detail || "Unknown error"}. Make sure the AI backend and Ollama are running with a model loaded.`,
			});
		} finally {
			setIsThinking(false);
		}
	}, [inputValue, isThinking, isConnected]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleStarterPrompt = (prompt: string) => {
		setInputValue(prompt);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			if (inputRef.current) {
				inputRef.current.selectionStart = prompt.length;
				inputRef.current.selectionEnd = prompt.length;
			}
		});
	};

	const handleStepClick = (stepId: string) => {
		setCompletedSteps((prev) => {
			const next = new Set(prev);
			if (next.has(stepId)) {
				next.delete(stepId);
			} else {
				next.add(stepId);
			}
			return next;
		});
	};

	const activeWorkflow = VIDEO_WORKFLOWS.find(
		(w) => w.id === selectedWorkflow,
	);

	return (
		<div className="relative flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="bg-background h-11 shrink-0 px-4 pr-2 flex items-center justify-between border-b">
				<span className="text-muted-foreground text-sm">
					AI Studio
				</span>
				<div className="flex items-center gap-1">
					{(mode === "chat" || mode === "transcript") && messages.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 text-[10px] px-1.5 text-muted-foreground"
							onClick={clearMessages}
						>
							<HugeiconsIcon icon={Delete02Icon} className="size-3" />
						</Button>
					)}
					{hasTranscript && (
						<Button
							variant={mode === "transcript" ? "secondary" : "ghost"}
							size="sm"
							className="h-6 text-[10px] px-2"
							onClick={() => setMode("transcript")}
						>
							Script
						</Button>
					)}
					<Button
						variant={mode === "chat" ? "secondary" : "ghost"}
						size="sm"
						className="h-6 text-[10px] px-2"
						onClick={() => setMode("chat")}
					>
						Chat
					</Button>
					<Button
						variant={mode === "workflow" ? "secondary" : "ghost"}
						size="sm"
						className="h-6 text-[10px] px-2"
						onClick={() => setMode("workflow")}
					>
						Workflows
					</Button>
				</div>
			</div>

			{/* Not connected banner */}
			{!isConnected && (
				<div className="mx-2 mt-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-500 shrink-0">
					<p className="font-medium">AI backend not connected</p>
					<p className="text-yellow-500/70 mt-0.5">
						Start the backend to use AI brainstorming.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="h-6 text-[10px] mt-1.5"
						onClick={toggleSetupGuide}
					>
						Setup guide
					</Button>
				</div>
			)}

			{/* ── Chat / Transcript Mode ── */}
			{(mode === "chat" || mode === "transcript") && (
				<>
					{/* Scrollable messages — fills available space */}
					<div
						ref={scrollRef}
						className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
					>
						{messages.length === 0 && mode === "transcript" && hasTranscript && (
							<div className="flex flex-col gap-3 py-4 px-1">
								<div className="text-center">
									<HugeiconsIcon
										icon={TextIcon}
										className="size-8 text-muted-foreground/30 mx-auto mb-2"
									/>
									<p className="text-xs font-medium">
										Edit script with AI
									</p>
									<p className="text-[10px] text-muted-foreground mt-0.5">
										Rewrite, improve, or transform your transcript
									</p>
								</div>

								<div className="rounded-md bg-muted/50 px-3 py-2 max-h-32 overflow-y-auto">
									<p className="text-[10px] text-muted-foreground leading-relaxed">
										{transcriptSegments.map((s) => s.text).join(" ").slice(0, 300)}
										{transcriptSegments.map((s) => s.text).join(" ").length > 300 && "..."}
									</p>
								</div>

								<div className="flex flex-col gap-1.5">
									{TRANSCRIPT_PROMPTS.map((starter) => (
										<button
											key={starter.label}
											type="button"
											onClick={() => {
												const fullText = transcriptSegments.map((s) => s.text).join(" ");
												handleStarterPrompt(starter.prompt + fullText);
											}}
											className="text-left rounded-md border px-2.5 py-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
										>
											{starter.label}
										</button>
									))}
								</div>
							</div>
						)}

						{messages.length === 0 && mode === "chat" && (
							<div className="flex flex-col gap-3 py-4 px-1">
								<div className="text-center">
									<HugeiconsIcon
										icon={SparklesIcon}
										className="size-8 text-muted-foreground/30 mx-auto mb-2"
									/>
									<p className="text-xs font-medium">
										Brainstorm with AI
									</p>
									<p className="text-[10px] text-muted-foreground mt-0.5">
										Plan your video, write scripts, generate
										ideas
									</p>
								</div>

								<div className="flex flex-col gap-1.5">
									{STARTER_PROMPTS.map((starter) => (
										<button
											key={starter.label}
											type="button"
											onClick={() =>
												handleStarterPrompt(
													starter.prompt,
												)
											}
											className="text-left rounded-md border px-2.5 py-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
										>
											{starter.label}
										</button>
									))}
								</div>
							</div>
						)}

						{messages.map((msg) => (
							<div key={msg.id} className="mb-3">
								{msg.role === "user" ? (
									<div className="rounded-lg bg-primary text-primary-foreground ml-6 px-3 py-2 text-xs">
										{msg.content}
									</div>
								) : (
									<div className="rounded-lg bg-muted mr-2 px-3 py-2.5">
										<div className="prose-studio text-xs leading-relaxed">
											<ReactMarkdown
												components={{
													h1: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
													h2: ({ children }) => <h4 className="text-xs font-bold mt-2 mb-1">{children}</h4>,
													h3: ({ children }) => <h4 className="text-xs font-semibold mt-1.5 mb-0.5">{children}</h4>,
													p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
													strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
													em: ({ children }) => <em className="italic">{children}</em>,
													ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
													ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
													li: ({ children }) => <li>{children}</li>,
													code: ({ children, className }) => {
														const isBlock = className?.includes("language-");
														if (isBlock) {
															return (
																<pre className="bg-background rounded px-2 py-1.5 my-1.5 overflow-x-auto text-[10px] font-mono">
																	<code>{children}</code>
																</pre>
															);
														}
														return (
															<code className="bg-background rounded px-1 py-0.5 text-[10px] font-mono">{children}</code>
														);
													},
													blockquote: ({ children }) => (
														<blockquote className="border-l-2 border-primary/40 pl-2 my-1.5 text-muted-foreground italic">
															{children}
														</blockquote>
													),
												}}
											>
												{msg.content}
											</ReactMarkdown>
										</div>
										<div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/50">
											<Button
												variant="ghost"
												size="sm"
												className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
												onClick={() => saveIdea(msg.content)}
											>
												<HugeiconsIcon icon={Bookmark01Icon} className="size-3" />
												Save idea
											</Button>
										</div>
									</div>
								)}
							</div>
						))}

						{isThinking && (
							<div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
								<Spinner className="size-3" />
								Thinking...
							</div>
						)}
					</div>

					{/* Input — ALWAYS at bottom, outside scroll */}
					<div className="border-t px-2 py-2 shrink-0 bg-background">
						<div className="flex items-end gap-1.5">
							<textarea
								ref={inputRef}
								value={inputValue}
								onChange={(event) =>
									setInputValue(event.target.value)
								}
								onKeyDown={handleKeyDown}
								placeholder={
									!isConnected
										? "Connect AI backend first"
										: mode === "transcript"
											? "Tell AI how to edit the transcript..."
											: "Describe your video idea..."
								}
								disabled={!isConnected}
								rows={1}
								className={cn(
									"flex-1 resize-none rounded-md border bg-transparent px-2.5 py-2 text-xs outline-none",
									"focus:ring-1 focus:ring-ring",
									"placeholder:text-muted-foreground/50",
									"disabled:opacity-50",
									"min-h-[36px] max-h-[100px]",
								)}
								style={
									{
										fieldSizing: "content",
									} as React.CSSProperties
								}
							/>
							<Button
								size="icon"
								variant={
									inputValue.trim() ? "default" : "secondary"
								}
								className="size-[36px] shrink-0"
								onClick={handleSend}
								disabled={
									!inputValue.trim() ||
									isThinking ||
									!isConnected
								}
							>
								{isThinking ? (
									<Spinner className="size-3.5" />
								) : (
									<HugeiconsIcon
										icon={SentIcon}
										className="size-3.5"
									/>
								)}
							</Button>
						</div>
						<p className="text-[9px] text-muted-foreground mt-1 text-center">
							Enter to send &middot; Shift+Enter for new line
						</p>
					</div>
				</>
			)}

			{/* ── Workflow Mode ── */}
			{mode === "workflow" && !activeWorkflow && (
				<div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
					<p className="text-[11px] text-muted-foreground px-1 mb-2">
						Follow a step-by-step guide to create your video from
						idea to export.
					</p>
					{VIDEO_WORKFLOWS.map((workflow) => (
						<button
							key={workflow.id}
							type="button"
							onClick={() => setSelectedWorkflow(workflow.id)}
							className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-accent transition-colors w-full mb-2"
						>
							<HugeiconsIcon
								icon={SparklesIcon}
								className="size-4 text-primary mt-0.5 shrink-0"
							/>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-medium">
									{workflow.title}
								</p>
								<p className="text-[10px] text-muted-foreground mt-0.5">
									{workflow.description}
								</p>
								<Badge
									variant="secondary"
									className="text-[9px] mt-1.5"
								>
									{workflow.steps.length} steps
								</Badge>
							</div>
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								className="size-3.5 text-muted-foreground mt-1 shrink-0"
							/>
						</button>
					))}
				</div>
			)}

			{/* ── Active Workflow ── */}
			{mode === "workflow" && activeWorkflow && (
				<div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
					<div className="flex items-center gap-2 px-1 mb-1">
						<button
							type="button"
							onClick={() => setSelectedWorkflow(null)}
							className="text-[10px] text-muted-foreground hover:text-foreground"
						>
							Workflows
						</button>
						<span className="text-[10px] text-muted-foreground">
							/
						</span>
						<span className="text-[11px] font-medium">
							{activeWorkflow.title}
						</span>
					</div>

					{/* Progress */}
					<div className="flex items-center gap-2 px-1 mb-2">
						<div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
							<div
								className="h-full bg-primary rounded-full transition-all"
								style={{
									width: `${(completedSteps.size / activeWorkflow.steps.length) * 100}%`,
								}}
							/>
						</div>
						<span className="text-[10px] text-muted-foreground tabular-nums">
							{completedSteps.size}/{activeWorkflow.steps.length}
						</span>
					</div>

					{/* Steps */}
					<div className="flex flex-col gap-2">
						{activeWorkflow.steps.map((step, index) => {
							const isCompleted = completedSteps.has(step.id);
							const isActive =
								!isCompleted &&
								(index === 0 ||
									completedSteps.has(
										activeWorkflow.steps[index - 1].id,
									));

							return (
								<button
									key={step.id}
									type="button"
									onClick={() => handleStepClick(step.id)}
									className={cn(
										"flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
										isCompleted &&
											"border-green-500/30 bg-green-500/5",
										isActive &&
											"border-primary/30 bg-primary/5",
										!isCompleted &&
											!isActive &&
											"opacity-60",
									)}
								>
									<div
										className={cn(
											"flex items-center justify-center size-5 rounded-full text-[9px] font-bold shrink-0 mt-0.5",
											isCompleted
												? "bg-green-500 text-white"
												: isActive
													? "bg-primary text-primary-foreground"
													: "bg-muted text-muted-foreground",
										)}
									>
										{isCompleted ? "\u2713" : index + 1}
									</div>

									<div className="flex-1 min-w-0">
										<p
											className={cn(
												"text-[11px] font-medium",
												isCompleted &&
													"line-through text-muted-foreground",
											)}
										>
											{step.label}
										</p>
										<p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
											{step.description}
										</p>
									</div>
								</button>
							);
						})}

						{/* Ask AI about this step */}
						{isConnected && (
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-[11px] mt-1"
								onClick={() => {
									setMode("chat");
									const currentStep =
										activeWorkflow.steps.find(
											(step) =>
												!completedSteps.has(step.id),
										);
									if (currentStep) {
										setInputValue(
											`Help me with "${currentStep.label}" for my ${activeWorkflow.title}. ${currentStep.description}`,
										);
										requestAnimationFrame(() =>
											inputRef.current?.focus(),
										);
									}
								}}
							>
								<HugeiconsIcon
									icon={SparklesIcon}
									className="size-3 mr-1"
								/>
								Ask AI about next step
							</Button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
