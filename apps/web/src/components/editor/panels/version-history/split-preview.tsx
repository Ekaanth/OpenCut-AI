"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import {
	computeTimelineHeatmap,
	HEATMAP_COLORS,
	type HeatmapSegment,
} from "@/services/diff/visual-diff";
import type { TimelineDiff, Commit } from "@/types/version";

/**
 * Split-screen preview for comparing two versions side by side.
 * Renders thumbnails of both commits with a timeline heatmap.
 *
 * NOTE: Full live dual-canvas playback requires two concurrent CanvasRenderer
 * instances which is expensive. This component provides the structural UI and
 * the timeline heatmap; live synced playback will be added in a future iteration.
 */
export function SplitPreview({
	commitA,
	commitB,
	diff,
	totalDuration,
}: {
	commitA: Commit;
	commitB: Commit;
	diff: TimelineDiff;
	totalDuration: number;
}) {
	const [viewMode, setViewMode] = useState<"split" | "toggle">("split");
	const [showingA, setShowingA] = useState(true);
	const heatmap = computeTimelineHeatmap(diff, totalDuration);

	return (
		<div className="flex flex-col gap-3">
			{/* Mode toggle */}
			<div className="flex items-center justify-between">
				<div className="text-xs text-muted-foreground">
					Comparing:{" "}
					<span className="font-medium text-foreground">{commitA.message}</span>
					{" vs "}
					<span className="font-medium text-foreground">{commitB.message}</span>
				</div>
				<div className="flex gap-1">
					<button
						type="button"
						className={`text-[10px] px-2 py-0.5 rounded ${
							viewMode === "split"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setViewMode("split")}
					>
						Split
					</button>
					<button
						type="button"
						className={`text-[10px] px-2 py-0.5 rounded ${
							viewMode === "toggle"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setViewMode("toggle")}
					>
						A/B Toggle
					</button>
				</div>
			</div>

			{/* Preview area */}
			{viewMode === "split" ? (
				<div className="flex gap-2">
					<PreviewFrame
						label="Version A"
						commit={commitA}
						className="flex-1"
					/>
					<PreviewFrame
						label="Version B"
						commit={commitB}
						className="flex-1"
					/>
				</div>
			) : (
				<div className="relative">
					<PreviewFrame
						label={showingA ? "Version A" : "Version B"}
						commit={showingA ? commitA : commitB}
					/>
					<button
						type="button"
						className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-background/80 border border-border hover:bg-muted"
						onClick={() => setShowingA(!showingA)}
					>
						Show {showingA ? "B" : "A"}
					</button>
				</div>
			)}

			{/* Timeline heatmap */}
			{totalDuration > 0 && (
				<div>
					<div className="text-[10px] text-muted-foreground mb-1">
						Timeline Changes
					</div>
					<div className="h-4 rounded overflow-hidden flex bg-muted">
						{heatmap.map((segment, idx) => (
							<div
								key={idx}
								className="h-full transition-all"
								style={{
									width: `${((segment.endTime - segment.startTime) / totalDuration) * 100}%`,
									backgroundColor: HEATMAP_COLORS[segment.type],
									opacity: segment.type === "unchanged" ? 0.2 : 0.7,
								}}
								title={`${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s: ${segment.type}`}
							/>
						))}
					</div>
					<div className="flex gap-3 mt-1">
						{(["added", "removed", "modified", "unchanged"] as const).map(
							(type) => (
								<div key={type} className="flex items-center gap-1">
									<span
										className="w-2 h-2 rounded"
										style={{
											backgroundColor: HEATMAP_COLORS[type],
											opacity: type === "unchanged" ? 0.3 : 0.7,
										}}
									/>
									<span className="text-[10px] text-muted-foreground capitalize">
										{type}
									</span>
								</div>
							),
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function PreviewFrame({
	label,
	commit,
	className = "",
}: {
	label: string;
	commit: Commit;
	className?: string;
}) {
	return (
		<div className={`${className}`}>
			<div className="text-[10px] text-muted-foreground mb-1">{label}</div>
			<div className="rounded border border-border overflow-hidden bg-black aspect-video flex items-center justify-center">
				{commit.thumbnailUrl ? (
					<img
						src={commit.thumbnailUrl}
						alt={label}
						className="w-full h-full object-contain"
					/>
				) : (
					<div className="text-xs text-muted-foreground/40">
						No preview available
					</div>
				)}
			</div>
			<div className="text-[10px] text-muted-foreground mt-1 truncate">
				{commit.message}
			</div>
		</div>
	);
}
