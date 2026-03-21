"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	TextIcon,
	Delete02Icon,
	AiMicIcon,
	Tick01Icon,
	CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useEditor } from "@/hooks/use-editor";
import { useTextTimelineBridge } from "@/hooks/use-text-timeline-bridge";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import {
	computeCutsFromDeletedSegments,
} from "@/lib/text-timeline-sync";
import { aiClient } from "@/lib/ai-client";
import { toast } from "sonner";

type ActionStatus = "idle" | "running" | "done";

const FILLER_WORDS = new Set([
	"um", "uh", "like", "you know", "so", "basically",
	"actually", "literally", "right", "well", "er", "ah",
	"hmm", "huh", "okay", "ok",
]);

/**
 * Floating bar that appears after transcription with one-click editing
 * operations. Designed for non-editors who want to clean up a video
 * without learning video editing.
 */
export function QuickActionsBar({ className }: { className?: string }) {
	const segments = useTranscriptStore((s) => s.segments);
	const editor = useEditor();
	const { handleDeleteSegments } = useTextTimelineBridge();

	const [fillerStatus, setFillerStatus] = useState<ActionStatus>("idle");
	const [fillerCount, setFillerCount] = useState(0);
	const [silenceStatus, setSilenceStatus] = useState<ActionStatus>("idle");
	const [silenceCount, setSilenceCount] = useState(0);
	const [factcheckStatus, setFactcheckStatus] = useState<ActionStatus>("idle");

	// Derive subtitle state from actual timeline tracks
	const subtitleTrackId = useMemo(() => {
		const tracks = editor.timeline.getTracks();
		const textTrack = tracks.find(
			(t) =>
				t.type === "text" &&
				t.elements.length > 0 &&
				t.elements.some((el) => ("name" in el && (el.name?.startsWith("Subtitle ") || el.name?.startsWith("Caption ")))),
		);
		return textTrack?.id ?? null;
	}, [editor, segments]); // re-derive when segments change (triggers re-render)

	// Derive filler count from transcript on mount / segment change
	const currentFillerCount = useMemo(() => {
		let count = 0;
		for (const seg of segments) {
			for (const w of seg.words) {
				const clean = w.word.toLowerCase().replace(/[.,!?]/g, "").trim();
				if (FILLER_WORDS.has(clean)) count++;
			}
		}
		return count;
	}, [segments]);

	// Derive silence count from transcript
	const currentSilenceCount = useMemo(() => {
		if (segments.length < 2) return 0;
		const sorted = [...segments].sort((a, b) => a.start - b.start);
		let count = 0;
		for (let i = 0; i < sorted.length - 1; i++) {
			const gap = sorted[i + 1].start - sorted[i].end;
			if (gap >= 1.0) count++;
		}
		return count;
	}, [segments]);

	// Derive effect track presence
	const hasEffectTrack = useMemo(() => {
		const tracks = editor.timeline.getTracks();
		return tracks.some((t) => t.type === "effect" && t.elements.length > 0);
	}, [editor, segments]);

	// --- Find & Remove Fillers ---
	const handleFillers = useCallback(() => {
		if (fillerStatus === "done") {
			// Remove segments that are entirely filler words
			const segs = useTranscriptStore.getState().segments;
			const segmentsToRemove: string[] = [];

			for (const seg of segs) {
				const words = seg.text.trim().split(/\s+/);
				const fillerWords = words.filter((w) =>
					FILLER_WORDS.has(w.toLowerCase().replace(/[.,!?]/g, "").trim()),
				);
				if (words.length > 0 && fillerWords.length / words.length >= 0.8) {
					segmentsToRemove.push(String(seg.id));
				}
			}

			if (segmentsToRemove.length > 0) {
				const toDelete = segs.filter((s) => segmentsToRemove.includes(String(s.id)));
				const cuts = computeCutsFromDeletedSegments(toDelete);
				handleDeleteSegments(segmentsToRemove, cuts);
				toast.success(`Removed ${segmentsToRemove.length} filler segments`);
			} else {
				toast.info("No segments are predominantly filler words. Use word-level editing in the transcript panel.");
			}
			setFillerStatus("idle");
		} else {
			setFillerCount(currentFillerCount);
			setFillerStatus("done");
			if (currentFillerCount > 0) {
				toast.success(`Found ${currentFillerCount} filler words`, {
					description: "Click again to remove them from the video.",
				});
			} else {
				toast.info("No filler words found in the transcript.");
			}
		}
	}, [fillerStatus, currentFillerCount, handleDeleteSegments]);

	// --- Find & Remove Silences ---
	const handleSilences = useCallback(() => {
		if (silenceStatus === "done") {
			toast.success("Silences are removed when you delete segments (gaps auto-close).");
			setSilenceStatus("idle");
		} else {
			setSilenceCount(currentSilenceCount);
			setSilenceStatus("done");
			if (currentSilenceCount > 0) {
				toast.success(`Found ${currentSilenceCount} silent gaps (>1s)`);
			} else {
				toast.info("No significant silences found between segments.");
			}
		}
	}, [silenceStatus, currentSilenceCount]);

	// --- Add / Remove Subtitles ---
	const handleSubtitles = useCallback(() => {
		if (subtitleTrackId) {
			editor.timeline.removeTrack({ trackId: subtitleTrackId });
			toast.success("Subtitles removed");
			return;
		}

		const currentSegments = useTranscriptStore.getState().segments;
		if (currentSegments.length === 0) return;

		const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
		const canvasSize = editor.project.getActive().settings.canvasSize;
		const subtitleY = canvasSize.height * 0.38;

		for (let i = 0; i < currentSegments.length; i++) {
			const seg = currentSegments[i];
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: `Subtitle ${i + 1}`,
					content: seg.text,
					duration: seg.end - seg.start,
					startTime: seg.start,
					fontSize: 4,
					fontWeight: "bold",
					color: "#ffffff",
					textAlign: "center",
					background: {
						enabled: true,
						color: "#000000",
						cornerRadius: 4,
						paddingX: 12,
						paddingY: 6,
						offsetX: 0,
						offsetY: 0,
					},
					opacity: 0.95,
					transform: {
						scale: 1,
						position: { x: 0, y: subtitleY },
						rotate: 0,
					},
				},
			});
		}

		toast.success("Subtitles added to timeline");
	}, [editor, subtitleTrackId]);

	// --- Fact Check ---
	const handleFactCheck = useCallback(async () => {
		const currentSegments = useTranscriptStore.getState().segments;
		if (currentSegments.length === 0) return;

		setFactcheckStatus("running");
		try {
			const fullText = currentSegments.map((s) => s.text).join(" ");
			const result = await aiClient.factCheck(fullText);

			if (result.claims.length === 0) {
				toast.info("No verifiable claims found.");
			} else {
				const trueCount = result.claims.filter((c) => c.verdict === "True").length;
				const falseCount = result.claims.filter((c) => c.verdict === "False").length;
				toast.success(`Fact check complete: ${result.claims.length} claims`, {
					description: `${trueCount} true, ${falseCount} false. Open the Fact Check panel for details.`,
				});
			}
			setFactcheckStatus("done");
		} catch {
			toast.error("Fact check failed. Make sure the AI backend is running.");
			setFactcheckStatus("idle");
		}
	}, []);

	// Early return AFTER all hooks to satisfy Rules of Hooks
	if (segments.length === 0) return null;

	const effectiveFillerCount = fillerStatus === "done" ? fillerCount : currentFillerCount;
	const effectiveSilenceCount = silenceStatus === "done" ? silenceCount : currentSilenceCount;

	const actions = [
		{
			id: "fillers",
			label: fillerStatus === "done" && effectiveFillerCount > 0 ? "Remove fillers" : currentFillerCount > 0 ? `${currentFillerCount} fillers` : "Find fillers",
			description: fillerStatus === "done" && effectiveFillerCount > 0
				? `${effectiveFillerCount} filler words found — click to remove`
				: currentFillerCount > 0
					? `${currentFillerCount} filler words detected`
					: "Scan for filler words (um, uh, like...)",
			icon: Delete02Icon,
			count: effectiveFillerCount > 0 ? effectiveFillerCount : undefined,
			status: currentFillerCount > 0 && fillerStatus === "idle" ? ("done" as ActionStatus) : fillerStatus,
			handler: handleFillers,
		},
		{
			id: "silences",
			label: silenceStatus === "done" && effectiveSilenceCount > 0 ? `${effectiveSilenceCount} gaps` : currentSilenceCount > 0 ? `${currentSilenceCount} gaps` : "Find silences",
			description: effectiveSilenceCount > 0
				? `${effectiveSilenceCount} silent gaps detected between segments`
				: "Detect long pauses between transcript segments",
			icon: AiMicIcon,
			count: effectiveSilenceCount > 0 ? effectiveSilenceCount : undefined,
			status: currentSilenceCount > 0 ? ("done" as ActionStatus) : silenceStatus,
			handler: handleSilences,
		},
		{
			id: "subtitles",
			label: subtitleTrackId ? "Remove subtitles" : "Add subtitles",
			description: subtitleTrackId
				? "Remove subtitle track from timeline"
				: "Add subtitle text overlay from transcript",
			icon: TextIcon,
			status: (subtitleTrackId ? "done" : "idle") as ActionStatus,
			handler: handleSubtitles,
		},
		{
			id: "factcheck",
			label: "Fact check",
			description: "Verify factual claims in the transcript",
			icon: CheckmarkBadge01Icon,
			status: factcheckStatus,
			handler: handleFactCheck,
		},
	];

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 rounded-lg border bg-background/95 backdrop-blur-sm px-2 py-1.5 shadow-sm",
				className,
			)}
		>
			<span className="text-[10px] text-muted-foreground font-medium px-1 shrink-0">
				Quick actions
			</span>
			<div className="w-px h-4 bg-border shrink-0" />
			{actions.map((action) => (
				<Tooltip key={action.id}>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"h-7 text-[11px] px-2 gap-1.5",
								action.status === "done" && "text-green-400",
							)}
							disabled={action.status === "running"}
							onClick={action.handler}
						>
							{action.status === "running" ? (
								<Spinner className="size-3" />
							) : action.status === "done" ? (
								<HugeiconsIcon
									icon={Tick01Icon}
									className="size-3"
								/>
							) : (
								<HugeiconsIcon
									icon={action.icon}
									className="size-3"
								/>
							)}
							{action.label}
							{action.count !== undefined && action.count > 0 && (
								<Badge
									variant="secondary"
									className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center"
								>
									{action.count}
								</Badge>
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="max-w-48 text-xs">
						{action.description}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}
