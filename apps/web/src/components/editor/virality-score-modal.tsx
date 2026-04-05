"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { aiClient } from "@/lib/ai-client";
import type { EngagementScoreResult } from "@/lib/ai-client";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

const GRADE_COLORS: Record<string, string> = {
	A: "text-green-400",
	B: "text-blue-400",
	C: "text-yellow-400",
	D: "text-orange-400",
	F: "text-red-400",
};

const GRADE_BG: Record<string, string> = {
	A: "bg-green-500/10 border-green-500/30",
	B: "bg-blue-500/10 border-blue-500/30",
	C: "bg-yellow-500/10 border-yellow-500/30",
	D: "bg-orange-500/10 border-orange-500/30",
	F: "bg-red-500/10 border-red-500/30",
};

const SCORE_LABELS: Record<string, string> = {
	hook: "Hook Strength",
	curiosity: "Curiosity Gap",
	energy: "Audio Energy",
	audio_sync: "Beat Sync",
	face_presence: "Face Presence",
	emotional_arc: "Emotional Arc",
	virality: "Viral Potential",
};

interface ViralityScoreModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ViralityScoreModal({ open, onOpenChange }: ViralityScoreModalProps) {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const [score, setScore] = useState<EngagementScoreResult | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const tracks = editor.timeline.getTracks();
	const hasVideo = tracks.some((t) =>
		t.elements.some((el) => el.type === "video" || el.type === "audio" || el.type === "image"),
	);

	const handleCheck = useCallback(async () => {
		setIsAnalyzing(true);
		setError(null);

		try {
			const transcriptText = segments.length > 0
				? segments.map((s) => s.text).join(" ")
				: "";
			const lastEnd = segments.length > 0
				? Math.max(...segments.map((s) => s.end))
				: 30;

			const result = await aiClient.engagementScore({
				transcript_text: transcriptText || "Video content without transcript",
				start: 0,
				end: lastEnd,
				title: "Current Project",
			});
			setScore(result);
			toast.success(`Virality Score: ${result.grade} (${Math.round(result.composite)}/100)`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Scoring failed";
			setError(msg);
			toast.error("Failed to check virality score");
		} finally {
			setIsAnalyzing(false);
		}
	}, [segments]);

	// Reset when modal closes
	const handleOpenChange = (v: boolean) => {
		if (!v) {
			setScore(null);
			setError(null);
		}
		onOpenChange(v);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Virality Score</DialogTitle>
				</DialogHeader>
				<DialogBody className="space-y-4">
					{/* No video state */}
					{!hasVideo && (
						<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-center space-y-2">
							<p className="text-sm font-medium text-yellow-400">No video on timeline</p>
							<p className="text-xs text-muted-foreground">
								Add a video to your timeline first, then check its virality score before publishing.
							</p>
							<Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
								Got it
							</Button>
						</div>
					)}

					{/* Has video — ready to score */}
					{hasVideo && !score && !isAnalyzing && !error && (
						<div className="text-center space-y-3">
							<p className="text-sm text-muted-foreground">
								Rate your video's viral potential before publishing. Get a score with actionable suggestions to improve engagement.
							</p>
							<Button className="w-full" onClick={handleCheck}>
								Check Virality Score
							</Button>
						</div>
					)}

					{/* Analyzing */}
					{isAnalyzing && (
						<div className="flex flex-col items-center gap-3 py-6">
							<Spinner className="h-6 w-6" />
							<p className="text-sm text-muted-foreground">Analyzing your video...</p>
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="space-y-3">
							<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
								<p className="text-sm text-red-400">{error}</p>
							</div>
							<Button variant="outline" className="w-full" onClick={handleCheck}>
								Retry
							</Button>
						</div>
					)}

					{/* Score result */}
					{score && (
						<div className="space-y-4">
							{/* Grade hero */}
							<div className={cn("rounded-xl border p-5 text-center", GRADE_BG[score.grade])}>
								<div className={cn("text-5xl font-bold", GRADE_COLORS[score.grade])}>
									{score.grade}
								</div>
								<div className="text-2xl font-semibold mt-1">
									{Math.round(score.composite)}<span className="text-sm text-muted-foreground">/100</span>
								</div>
								<p className="text-xs text-muted-foreground mt-1">{score.grade_label}</p>
							</div>

							{/* Verdict */}
							<div className="rounded-lg border p-3 text-center">
								{score.composite >= 70 ? (
									<p className="text-sm font-medium text-green-400">Ready to go viral!</p>
								) : score.composite >= 50 ? (
									<p className="text-sm font-medium text-yellow-400">Good potential, check suggestions below</p>
								) : (
									<p className="text-sm font-medium text-red-400">Needs improvement before publishing</p>
								)}
							</div>

							{/* Sub-scores */}
							<div className="space-y-2">
								<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Breakdown</h4>
								{Object.entries(SCORE_LABELS).map(([key, label]) => {
									const sub = score[key as keyof EngagementScoreResult];
									const val = typeof sub === "object" && sub !== null && "composite" in sub
										? (sub as { composite: number }).composite
										: 0;

									return (
										<div key={key} className="flex items-center gap-2">
											<span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
											<div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
												<div
													className={cn(
														"h-full rounded-full transition-all",
														val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-500" : "bg-red-500",
													)}
													style={{ width: `${val}%` }}
												/>
											</div>
											<span className="text-xs text-muted-foreground w-7 text-right">{Math.round(val)}</span>
										</div>
									);
								})}
							</div>

							{/* Suggestions */}
							{score.suggestions.length > 0 && (
								<div className="space-y-2">
									<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</h4>
									{score.suggestions.map((s, i) => (
										<div key={i} className="flex items-start gap-2 text-xs">
											<span className={cn(
												"mt-1 h-2 w-2 rounded-full flex-shrink-0",
												s.expected_impact === "high" ? "bg-red-400" : "bg-yellow-400",
											)} />
											<p className="text-muted-foreground">{s.suggestion}</p>
										</div>
									))}
								</div>
							)}

							{/* Actions */}
							<div className="flex gap-2">
								<Button variant="outline" className="flex-1" onClick={handleCheck}>
									Re-check
								</Button>
								<Button className="flex-1" onClick={() => handleOpenChange(false)}>
									Done
								</Button>
							</div>
						</div>
					)}
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
