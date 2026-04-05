"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useYouTubeReelsStore } from "@/stores/youtube-reels-store";
import { ClipCard } from "./clip-card";
import { ScoreBreakdown } from "./score-breakdown";

type SortKey = "score" | "duration" | "position";

export function ClipGrid() {
	const clips = useYouTubeReelsStore((s) => s.detectedClips);
	const selected = useYouTubeReelsStore((s) => s.selectedIndices);
	const toggle = useYouTubeReelsStore((s) => s.toggleClipSelection);
	const selectAll = useYouTubeReelsStore((s) => s.selectAll);
	const deselectAll = useYouTubeReelsStore((s) => s.deselectAll);
	const startGeneration = useYouTubeReelsStore((s) => s.startGeneration);

	const [sortKey, setSortKey] = useState<SortKey>("score");
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	const sorted = [...clips].sort((a, b) => {
		if (sortKey === "score") return (b.engagement?.composite ?? 0) - (a.engagement?.composite ?? 0);
		if (sortKey === "duration") return (b.end - b.start) - (a.end - a.start);
		return a.start - b.start;
	});

	const totalDuration = sorted
		.filter((c) => selected.has(c.index))
		.reduce((sum, c) => sum + (c.end - c.start), 0);

	return (
		<div className="space-y-3">
			{/* Controls */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
						Select All
					</Button>
					<Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>
						Clear
					</Button>
				</div>
				<div className="flex items-center gap-1">
					{(["score", "position", "duration"] as SortKey[]).map((key) => (
						<Button
							key={key}
							variant={sortKey === key ? "secondary" : "ghost"}
							size="sm"
							className="text-xs h-7"
							onClick={() => setSortKey(key)}
						>
							{key === "score" ? "Score" : key === "position" ? "Time" : "Length"}
						</Button>
					))}
				</div>
			</div>

			{/* Summary */}
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Badge variant="secondary" className="text-xs">
					{selected.size} of {clips.length} selected
				</Badge>
				<span>
					{Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, "0")} total
				</span>
			</div>

			{/* Clip cards */}
			<div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
				{sorted.map((clip) => (
					<div key={clip.index}>
						<ClipCard
							clip={clip}
							selected={selected.has(clip.index)}
							onToggle={() => toggle(clip.index)}
							onExpand={() => setExpandedIndex(expandedIndex === clip.index ? null : clip.index)}
						/>
						{expandedIndex === clip.index && clip.engagement && (
							<div className="mt-1 ml-4 p-3 border rounded-lg bg-card">
								<ScoreBreakdown score={clip.engagement} />
							</div>
						)}
					</div>
				))}
			</div>

			{/* Export button */}
			<Button
				className="w-full"
				disabled={selected.size === 0}
				onClick={() => { startGeneration().catch(() => {}); }}
			>
				Generate {selected.size} Reel{selected.size !== 1 ? "s" : ""}
			</Button>
		</div>
	);
}
