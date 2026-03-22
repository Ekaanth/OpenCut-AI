"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTextTimelineBridge } from "@/hooks/use-text-timeline-bridge";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { useEditor } from "@/hooks/use-editor";
import { LANGUAGES } from "@/constants/language-constants";
import { cn } from "@/utils/ui";
import { ScrollArea } from "@/components/ui/scroll-area";
import { aiClient } from "@/lib/ai-client";
import { hasMediaId } from "@/lib/timeline";
import type { TimelineElement } from "@/types/timeline";
import {
	TranscriptionPanel,
	type TranscriptSegment,
	type TranscriptWord,
	type SilenceRegion,
} from "./transcription-panel";

function formatTimestamp(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Wraps TranscriptionPanel and connects it to the video timeline
 * via the text-timeline bridge hook.
 *
 * Shows the original transcript as the primary tab, with
 * translated transcripts in additional tabs.
 */
export function TextEditingPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const {
		handleDeleteSegments,
		handleCutWords,
		handleReorderSegments,
		handleSeekTo,
		handleTranscribe,
		isTranscribing,
		progress,
		error,
	} = useTextTimelineBridge();

	const [activeTab, setActiveTab] = useState("original");
	const [isDetectingSpeakers, setIsDetectingSpeakers] = useState(false);

	// Continuously track playback time so word/segment highlighting updates live
	const [currentTime, setCurrentTime] = useState(0);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		let running = true;
		const tick = () => {
			if (!running) return;
			setCurrentTime(editor.playback.getCurrentTime());
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			running = false;
			cancelAnimationFrame(rafRef.current);
		};
	}, [editor]);

	const storeSegments = useTranscriptStore((s) => s.segments);
	const storeLanguage = useTranscriptStore((s) => s.language);
	const storeSilences = useTranscriptStore((s) => s.silences);
	const translations = useTranscriptStore((s) => s.translations);
	const speakerNames = useTranscriptStore((s) => s.speakerNames);

	// ── Speaker Diarization ──
	const handleDetectSpeakers = useCallback(async () => {
		const taskId = `speaker-diarization-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		setIsDetectingSpeakers(true);
		bgTasks.addTask({
			id: taskId,
			type: "speaker-diarization",
			label: "Speaker detection",
			progress: "Finding media file...",
		});

		try {
			// Find the media file from the timeline
			const tracks = editor.timeline.getTracks();
			let foundMediaId: string | null = null;
			for (const track of tracks) {
				for (const element of track.elements) {
					if (
						(track.type === "video" || track.type === "audio") &&
						hasMediaId(element as TimelineElement)
					) {
						foundMediaId = (element as TimelineElement & { mediaId: string }).mediaId;
						break;
					}
				}
				if (foundMediaId) break;
			}

			if (!foundMediaId) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: "No video or audio found on the timeline.",
					completedAt: Date.now(),
				});
				return;
			}

			const mediaAsset = editor.media.getAssets().find((asset) => asset.id === foundMediaId);
			if (!mediaAsset?.file) {
				bgTasks.updateTask(taskId, {
					status: "error",
					error: "Cannot access the media file.",
					completedAt: Date.now(),
				});
				return;
			}

			bgTasks.updateTask(taskId, { progress: "Running speaker diarization..." });

			// Ensure proper file extension
			let file = mediaAsset.file;
			const fileName = file.name || "";
			if (!fileName.includes(".")) {
				const ext = file.type?.includes("video") ? ".mp4" : ".wav";
				file = new File([file], `media${ext}`, { type: file.type || "video/mp4" });
			}

			const result = await aiClient.analyzeSpeakers(file);

			if (result.segments.length === 0) {
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: "No speakers detected",
					completedAt: Date.now(),
				});
				return;
			}

			// Apply diarization to transcript segments
			useTranscriptStore.getState().applySpeakerDiarization(result.segments);

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `${result.num_speakers} speakers detected (${result.method})`,
				completedAt: Date.now(),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Speaker detection failed";
			let detail = message;
			if (message.includes("Cannot connect") || message.includes("connection_refused")) {
				detail = "AI backend not reachable. Start with: docker compose up -d ai-backend";
			} else if (message.includes("404")) {
				detail = "Speaker endpoint not found. Restart the AI backend to load the new route: docker compose restart ai-backend";
			} else if (message.includes("503")) {
				detail = "Speaker service is not running. Start with: docker compose up -d speaker-service";
			}
			bgTasks.updateTask(taskId, {
				status: "error",
				error: detail,
				completedAt: Date.now(),
			});
		} finally {
			setIsDetectingSpeakers(false);
		}
	}, [editor]);

	const handleRenameSpeaker = useCallback((speakerId: string, newName: string) => {
		useTranscriptStore.getState().setSpeakerName(speakerId, newName);
	}, []);

	const originalLanguageName =
		LANGUAGES.find((l) => l.code === storeLanguage)?.name ?? storeLanguage ?? "Original";

	// Map store segments to panel format
	const panelSegments: TranscriptSegment[] = useMemo(
		() =>
			storeSegments.map((seg) => ({
				id: String(seg.id),
				startTime: seg.start,
				endTime: seg.end,
				words: seg.words.map((w, i) => ({
					id: `${seg.id}-${i}`,
					text: w.word,
					startTime: w.start,
					endTime: w.end,
					confidence: w.confidence,
				})),
				speaker: seg.speaker,
			})),
		[storeSegments],
	);

	const panelSilences: SilenceRegion[] = useMemo(
		() =>
			storeSilences.map((s) => ({
				startTime: s.start,
				endTime: s.end,
				duration: s.duration,
			})),
		[storeSilences],
	);

	const status = isTranscribing
		? "transcribing"
		: storeSegments.length > 0
			? "complete"
			: "idle";

	// Reset to original tab if the selected translation is removed
	const validTab =
		activeTab === "original" ||
		translations.some((t) => t.languageCode === activeTab);
	const currentTab = validTab ? activeTab : "original";

	const hasTabs = translations.length > 0;

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Tabs row */}
			{hasTabs && (
				<div className="flex items-center border-b shrink-0">
					<div className="overflow-x-auto scrollbar-hidden">
						<div className="flex items-center gap-0 px-1 w-max">
							<TabButton
								active={currentTab === "original"}
								onClick={() => setActiveTab("original")}
							>
								{originalLanguageName}
							</TabButton>
							{translations.map((t) => (
								<TabButton
									key={t.languageCode}
									active={currentTab === t.languageCode}
									onClick={() => setActiveTab(t.languageCode)}
								>
									{t.languageName}
								</TabButton>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Content */}
			{currentTab === "original" ? (
				<TranscriptionPanel
					segments={panelSegments}
					silences={panelSilences}
					status={status as "idle" | "transcribing" | "complete" | "error"}
					progress={progress}
					currentTime={currentTime}
					onTranscribe={handleTranscribe}
					onSeekTo={handleSeekTo}
					onDeleteSegments={handleDeleteSegments}
					onCutWords={handleCutWords}
					onReorderSegments={handleReorderSegments}
					onDetectSpeakers={handleDetectSpeakers}
					speakerNames={speakerNames}
					onRenameSpeaker={handleRenameSpeaker}
					isDetectingSpeakers={isDetectingSpeakers}
					error={error ?? undefined}
				/>
			) : (
				<TranslationView
					languageCode={currentTab}
					currentTime={currentTime}
					onSeekTo={handleSeekTo}
				/>
			)}
		</div>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
				active
					? "border-primary text-foreground"
					: "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
			)}
		>
			{children}
		</button>
	);
}

function TranslationView({
	languageCode,
	currentTime,
	onSeekTo,
}: {
	languageCode: string;
	currentTime: number;
	onSeekTo: (time: number) => void;
}) {
	const translation = useTranscriptStore((s) =>
		s.translations.find((t) => t.languageCode === languageCode),
	);

	if (!translation) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<p className="text-sm text-muted-foreground">
					Translation not found.
				</p>
			</div>
		);
	}

	return (
		<ScrollArea className="flex-1">
			<div className="flex flex-col gap-0.5 p-3">
				{translation.segments.map((seg, idx) => {
					const isActive =
						currentTime >= seg.start && currentTime < seg.end;
					return (
						<button
							key={seg.id ?? idx}
							type="button"
							onClick={() => onSeekTo(seg.start)}
							className={cn(
								"text-left rounded-md px-3 py-2 text-sm leading-relaxed transition-colors",
								isActive
									? "bg-primary/10 text-foreground"
									: "text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							<span className="text-[10px] font-mono tabular-nums text-muted-foreground mr-2">
								{formatTimestamp(seg.start)}
							</span>
							{seg.text}
						</button>
					);
				})}
			</div>
		</ScrollArea>
	);
}
