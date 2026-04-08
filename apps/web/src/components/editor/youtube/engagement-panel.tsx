"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { aiClient } from "@/lib/ai-client";
import { useEngagementStore } from "@/stores/engagement-store";
import { useTranscriptStore } from "@/stores/transcript-store";
import { ScoreBreakdown } from "./score-breakdown";
import { toast } from "sonner";

/**
 * Engagement Score panel for the editor.
 *
 * Allows users to check their video's engagement score at any time
 * during editing or before export. Works with any video on the timeline.
 */
export function EngagementPanel({ className }: { className?: string }) {
	const score = useEngagementStore((s) => s.currentScore);
	const isAnalyzing = useEngagementStore((s) => s.isAnalyzing);
	const error = useEngagementStore((s) => s.error);
	const setScore = useEngagementStore((s) => s.setScore);
	const setAnalyzing = useEngagementStore((s) => s.setAnalyzing);
	const setError = useEngagementStore((s) => s.setError);
	const clear = useEngagementStore((s) => s.clear);
	const lastAnalyzedAt = useEngagementStore((s) => s.lastAnalyzedAt);

	const segments = useTranscriptStore((s) => s.segments);

	const handleCheck = useCallback(async () => {
		setAnalyzing(true);

		try {
			// Use real transcript from the editor if available
			const transcriptText = segments.length > 0
				? segments.map((s) => s.text).join(" ")
				: "";

			const lastEnd = segments.length > 0
				? Math.max(...segments.map((s) => s.end))
				: 30;

			const result = await aiClient.engagementScore({
				transcript_text: transcriptText || "No transcript available",
				start: 0,
				end: lastEnd,
				title: "Current Project",
			});
			setScore(result);
			toast.success(`Engagement Score: ${result.grade} (${Math.round(result.composite)}/100)`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Scoring failed";
			setError(msg);
			toast.error("Failed to check engagement score");
		} finally {
			setAnalyzing(false);
		}
	}, [segments, setScore, setAnalyzing, setError]);

	return (
		<div className={className}>
			<div className="space-y-4 p-1">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold">Engagement Score</h3>
					{score && (
						<Button variant="ghost" size="sm" className="text-xs h-7" onClick={clear}>
							Clear
						</Button>
					)}
				</div>

				<p className="text-xs text-muted-foreground">
					Check how engaging your video is before publishing. Get a score with actionable suggestions.
				</p>

				{/* Idle state */}
				{!score && !isAnalyzing && !error && (
					<Button className="w-full" onClick={handleCheck}>
						Check Engagement Score
					</Button>
				)}

				{/* Analyzing */}
				{isAnalyzing && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Spinner className="h-4 w-4" />
						<span>Analyzing engagement...</span>
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="space-y-2">
						<p className="text-xs text-red-400">{error}</p>
						<Button variant="outline" size="sm" onClick={handleCheck}>
							Retry
						</Button>
					</div>
				)}

				{/* Score result */}
				{score && (
					<>
						{/* Verdict banner */}
						<div className="rounded-lg border p-3 text-center space-y-1">
							{score.composite >= 70 ? (
								<>
									<p className="text-sm font-medium text-green-400">Ready to publish!</p>
									<p className="text-xs text-muted-foreground">Your video has strong engagement potential.</p>
								</>
							) : score.composite >= 50 ? (
								<>
									<p className="text-sm font-medium text-yellow-400">Good, but could improve</p>
									<p className="text-xs text-muted-foreground">Check the suggestions below.</p>
								</>
							) : (
								<>
									<p className="text-sm font-medium text-red-400">Needs work</p>
									<p className="text-xs text-muted-foreground">Apply the suggestions to boost engagement.</p>
								</>
							)}
						</div>

						<ScoreBreakdown score={score} />

						{lastAnalyzedAt && (
							<p className="text-[10px] text-muted-foreground text-right">
								Checked {new Date(lastAnalyzedAt).toLocaleTimeString()}
							</p>
						)}

						<Button variant="outline" className="w-full" onClick={handleCheck}>
							Re-check Score
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
