"use client";

import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Upload04Icon,
	AiMicIcon,
	TextIcon,
	SparklesIcon,
	Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { useAIStore } from "@/stores/ai-store";

interface GuideStep {
	icon: typeof Upload04Icon;
	title: string;
	description: string;
	shortcut?: string;
}

const GUIDE_STEPS: GuideStep[] = [
	{
		icon: Upload04Icon,
		title: "Import a video",
		description: "Drag a file here or use the media panel on the left",
	},
	{
		icon: AiMicIcon,
		title: "Transcribe it",
		description: "Click the mic button to convert speech to editable text",
		shortcut: "Toolbar",
	},
	{
		icon: TextIcon,
		title: "Edit the transcript",
		description: "Delete sentences, remove filler words, reorder sections",
	},
	{
		icon: SparklesIcon,
		title: "Export your video",
		description: "Choose a platform preset and export with one click",
	},
];

/**
 * Shows a visual guide when the editor has no content.
 * Replaces the empty Properties panel for first-time users.
 */
export function EmptyEditorGuide({ className }: { className?: string }) {
	const savedIdeas = useAIStore((s) => s.savedIdeas);
	const removeIdea = useAIStore((s) => s.removeIdea);

	return (
		<div
			className={cn(
				"flex flex-col items-center h-full px-6 py-8 gap-6 overflow-hidden",
				className,
			)}
		>
			<div className="text-center">
				<h3 className="text-sm font-medium">Get started</h3>
				<p className="text-xs text-muted-foreground mt-1">
					Edit video by editing text
				</p>
			</div>

			<div className="flex flex-col gap-3 w-full max-w-52">
				{GUIDE_STEPS.map((step, index) => (
					<div key={step.title} className="flex items-start gap-2.5">
						<div className="flex items-center justify-center size-7 rounded-full bg-muted text-muted-foreground shrink-0 mt-0.5">
							<span className="text-[10px] font-bold">{index + 1}</span>
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium">{step.title}</p>
							<p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
								{step.description}
							</p>
						</div>
					</div>
				))}
			</div>

			<div className="text-center">
				<p className="text-[10px] text-muted-foreground">
					Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Ctrl+K</kbd> for AI commands
				</p>
			</div>

			{/* Ideas Board */}
			{savedIdeas.length > 0 && (
				<div className="flex flex-col gap-2 w-full max-w-52 min-h-0">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-medium">
							Ideas{" "}
							<span className="text-muted-foreground">({savedIdeas.length})</span>
						</h4>
					</div>
					<ScrollArea className="flex-1 min-h-0 max-h-40">
						<div className="flex flex-col gap-1.5">
							{savedIdeas.map((idea) => (
								<div
									key={idea.id}
									className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs group"
								>
									<div className="flex-1 min-w-0">
										<p className="line-clamp-2 text-foreground">{idea.content}</p>
										<p className="text-[10px] text-muted-foreground mt-1">
											{new Date(idea.savedAt).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="size-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={() => removeIdea(idea.id)}
									>
										<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
									</Button>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			)}
		</div>
	);
}
