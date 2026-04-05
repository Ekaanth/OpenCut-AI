"use client";

import { cn } from "@/utils/ui";
import { Badge } from "@/components/ui/badge";
import type { EngagementScoreResult } from "@/lib/ai-client";

const GRADE_COLORS: Record<string, string> = {
	A: "text-green-400",
	B: "text-blue-400",
	C: "text-yellow-400",
	D: "text-orange-400",
	F: "text-red-400",
};

interface BeforeAfterProps {
	before: EngagementScoreResult;
	after: EngagementScoreResult;
}

const SUB_SCORES = ["hook", "curiosity", "energy", "audio_sync", "face_presence", "emotional_arc", "virality"] as const;

const LABELS: Record<string, string> = {
	hook: "Hook",
	curiosity: "Curiosity",
	energy: "Energy",
	audio_sync: "Beat Sync",
	face_presence: "Face",
	emotional_arc: "Arc",
	virality: "Viral",
};

export function BeforeAfterComparison({ before, after }: BeforeAfterProps) {
	const delta = Math.round(after.composite - before.composite);
	const gradeChanged = before.grade !== after.grade;

	return (
		<div className="space-y-3 rounded-lg border p-3 bg-card">
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold">Before / After Enhancement</span>
				<Badge
					variant="outline"
					className={cn(
						"text-xs",
						delta > 0 ? "border-green-500/50 text-green-400" : delta < 0 ? "border-red-500/50 text-red-400" : "text-muted-foreground",
					)}
				>
					{delta > 0 ? "+" : ""}{delta} points
				</Badge>
			</div>

			{/* Grade comparison */}
			<div className="flex items-center justify-center gap-4">
				<div className="text-center">
					<span className="text-[10px] text-muted-foreground">Before</span>
					<div className={cn("text-2xl font-bold", GRADE_COLORS[before.grade])}>
						{before.grade}
					</div>
					<span className="text-xs text-muted-foreground">{Math.round(before.composite)}</span>
				</div>

				<span className="text-lg text-muted-foreground">→</span>

				<div className="text-center">
					<span className="text-[10px] text-muted-foreground">After</span>
					<div className={cn("text-2xl font-bold", GRADE_COLORS[after.grade])}>
						{after.grade}
					</div>
					<span className="text-xs text-muted-foreground">{Math.round(after.composite)}</span>
				</div>
			</div>

			{gradeChanged && (
				<p className={cn(
					"text-center text-xs",
					after.composite > before.composite ? "text-green-400" : "text-red-400",
				)}>
					{after.composite > before.composite ? "Grade improved" : "Grade changed"}: {before.grade} → {after.grade}
				</p>
			)}

			{/* Sub-score deltas */}
			<div className="space-y-1">
				{SUB_SCORES.map((key) => {
					const bSub = before[key];
					const aSub = after[key];
					const bVal = typeof bSub === "object" && bSub !== null && "composite" in bSub
						? (bSub as { composite: number }).composite : 0;
					const aVal = typeof aSub === "object" && aSub !== null && "composite" in aSub
						? (aSub as { composite: number }).composite : 0;
					const d = Math.round(aVal - bVal);

					return (
						<div key={key} className="flex items-center gap-2 text-[10px]">
							<span className="w-14 text-muted-foreground truncate">{LABELS[key]}</span>
							<div className="flex-1 flex items-center gap-1">
								<span className="w-6 text-right text-muted-foreground">{Math.round(bVal)}</span>
								<span className="text-muted-foreground">→</span>
								<span className="w-6">{Math.round(aVal)}</span>
							</div>
							{d !== 0 && (
								<span className={d > 0 ? "text-green-400" : "text-red-400"}>
									{d > 0 ? "+" : ""}{d}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
