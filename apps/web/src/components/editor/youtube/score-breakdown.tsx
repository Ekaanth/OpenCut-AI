"use client";

import { cn } from "@/utils/ui";
import type { EngagementScoreResult } from "@/lib/ai-client";

const GRADE_COLORS: Record<string, string> = {
	A: "text-green-400",
	B: "text-blue-400",
	C: "text-yellow-400",
	D: "text-orange-400",
	F: "text-red-400",
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

export function ScoreBreakdown({ score }: { score: EngagementScoreResult }) {
	const entries = Object.entries(SCORE_LABELS);

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-baseline gap-2">
					<span className={cn("text-2xl font-bold", GRADE_COLORS[score.grade])}>
						{score.grade}
					</span>
					<span className="text-lg font-semibold">{Math.round(score.composite)}</span>
					<span className="text-xs text-muted-foreground">/100</span>
				</div>
				<span className="text-xs text-muted-foreground">{score.grade_label}</span>
			</div>

			{/* Score bars */}
			<div className="space-y-1.5">
				{entries.map(([key, label]) => {
					const sub = score[key as keyof EngagementScoreResult];
					const val = typeof sub === "object" && sub !== null && "composite" in sub
						? (sub as { composite: number }).composite
						: 0;

					return (
						<div key={key} className="flex items-center gap-2">
							<span className="text-[10px] text-muted-foreground w-20 flex-shrink-0 truncate">
								{label}
							</span>
							<div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full transition-all",
										val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-500" : "bg-red-500",
									)}
									style={{ width: `${val}%` }}
								/>
							</div>
							<span className="text-[10px] text-muted-foreground w-6 text-right">
								{Math.round(val)}
							</span>
						</div>
					);
				})}
			</div>

			{/* Suggestions */}
			{score.suggestions.length > 0 && (
				<div className="space-y-1.5 pt-2 border-t border-border/50">
					<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
						Suggestions
					</span>
					{score.suggestions.map((s, i) => (
						<div key={i} className="flex items-start gap-1.5">
							<span className={cn(
								"mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0",
								s.expected_impact === "high" ? "bg-red-400" : "bg-yellow-400",
							)} />
							<p className="text-xs text-muted-foreground">{s.suggestion}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
