"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTextTimelineBridge } from "@/hooks/use-text-timeline-bridge";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useEditor } from "@/hooks/use-editor";
import { LANGUAGES } from "@/constants/language-constants";
import { cn } from "@/utils/ui";
import { ScrollArea } from "@/components/ui/scroll-area";
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
