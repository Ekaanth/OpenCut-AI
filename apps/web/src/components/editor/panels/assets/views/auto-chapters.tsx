"use client";

import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { toast } from "sonner";
import type { Chapter } from "@/types/ai";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AutoChaptersPanel() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const chapters = useTranscriptStore((s) => s.chapters);
	const setChapters = useTranscriptStore((s) => s.setChapters);
	const addTask = useBackgroundTasksStore((s) => s.addTask);
	const updateTask = useBackgroundTasksStore((s) => s.updateTask);

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
	const [suggestedDescription, setSuggestedDescription] = useState<string | null>(
		null,
	);

	const handleAnalyze = useCallback(async () => {
		const mediaAssets = editor.media.getAssets();
		const videoAsset = mediaAssets.find((a) => a.type === "video");
		if (!videoAsset) {
			toast.error("No video asset found");
			return;
		}

		setIsAnalyzing(true);
		const taskId = `chapters-${Date.now()}`;
		addTask({
			id: taskId,
			type: "dubbing",
			label: "Analyzing video structure",
			progress: "Analyzing...",
		});

		try {
			const result = await aiClient.analyzeStructure(videoAsset.file);

			setChapters(result.chapters);
			if (result.suggestedTitle) setSuggestedTitle(result.suggestedTitle);
			if (result.suggestedDescription)
				setSuggestedDescription(result.suggestedDescription);

			updateTask(taskId, {
				status: "completed",
				progress: `${result.chapters.length} chapters found`,
				completedAt: Date.now(),
			});

			toast.success(`Found ${result.chapters.length} chapters`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Analysis failed";
			updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
			toast.error("Structure analysis failed", { description: message });
		} finally {
			setIsAnalyzing(false);
		}
	}, [editor, setChapters, addTask, updateTask]);

	const handleChapterClick = useCallback(
		(start: number) => {
			editor.playback.seek({ time: start });
		},
		[editor],
	);

	return (
		<div className="flex flex-col gap-4 p-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Auto Chapters</span>
				{chapters.length > 0 && (
					<Badge variant="secondary" className="text-[8px] px-1 py-0">
						{chapters.length} chapters
					</Badge>
				)}
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Analyzes your video's structure to detect topic changes, key moments,
				and natural chapter boundaries. Click any chapter to jump to it.
			</p>

			{suggestedTitle && (
				<div className="rounded-md border p-2">
					<span className="text-[9px] text-muted-foreground">
						Suggested title
					</span>
					<p className="text-[11px] font-medium">{suggestedTitle}</p>
					{suggestedDescription && (
						<p className="text-[9px] text-muted-foreground mt-1">
							{suggestedDescription}
						</p>
					)}
				</div>
			)}

			{chapters.length > 0 && (
				<div className="flex flex-col gap-1">
					{chapters.map((chapter, i) => (
						<button
							key={`ch-${i}`}
							type="button"
							onClick={() => handleChapterClick(chapter.start)}
							className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-left hover:bg-accent transition-colors"
						>
							<div className="flex flex-col items-center shrink-0">
								<span className="text-[9px] font-mono text-muted-foreground">
									{formatTime(chapter.start)}
								</span>
								<span className="text-[8px] text-muted-foreground">
									→ {formatTime(chapter.end)}
								</span>
							</div>
							<div className="flex flex-col min-w-0 flex-1">
								<span className="text-[10px] font-medium truncate">
									{i + 1}. {chapter.title}
								</span>
								{chapter.summary && (
									<span className="text-[9px] text-muted-foreground line-clamp-2">
										{chapter.summary}
									</span>
								)}
							</div>
							<Badge
								variant="outline"
								className="text-[8px] px-1 py-0 shrink-0"
							>
								{formatTime(chapter.end - chapter.start)}
							</Badge>
						</button>
					))}
				</div>
			)}

			{chapters.length === 0 && !isAnalyzing && (
				<div className="flex flex-col items-center gap-2 py-4 text-center">
					<p className="text-[10px] text-muted-foreground">
						No chapters detected yet. Analyze your video to detect topic
						changes.
					</p>
				</div>
			)}

			<button
				type="button"
				disabled={isAnalyzing || segments.length === 0}
				onClick={handleAnalyze}
				className={cn(
					"w-full rounded-md py-2 text-xs font-medium transition-colors",
					isAnalyzing
						? "bg-muted text-muted-foreground cursor-not-allowed"
						: "bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				{isAnalyzing ? "Analyzing..." : "Detect Chapters"}
			</button>
		</div>
	);
}
