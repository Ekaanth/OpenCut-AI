"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useAutoBRoll, type BRollSuggestion } from "@/hooks/use-auto-broll";
import { useTranscriptStore } from "@/stores/transcript-store";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { getIndexedCount } from "@/services/search/embedding-store";
import { toast } from "sonner";

export function AutoBRollPanel() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const { run, indexAll, applyMatch, isRunning, progress, result } = useAutoBRoll();

	const [indexedCount, setIndexedCount] = useState(0);
	const [threshold, setThreshold] = useState(0.2);
	const [autoApply, setAutoApply] = useState(false);

	const assets = editor.media.getAssets();
	const indexableAssets = assets.filter((a) => a.type === "video" || a.type === "image").length;

	const refreshCount = useCallback(() => {
		getIndexedCount().then(setIndexedCount).catch(() => setIndexedCount(0));
	}, []);
	useEffect(() => {
		refreshCount();
		return editor.media.subscribe(() => setTimeout(refreshCount, 300));
	}, [editor.media, refreshCount]);

	const handleRun = useCallback(() => {
		if (indexedCount === 0) {
			toast.error("Index your footage first.");
			return;
		}
		if (segments.length === 0) {
			toast.error("Transcribe your media first.");
			return;
		}
		run({ threshold, autoApply });
	}, [indexedCount, segments.length, run, threshold, autoApply]);

	return (
		<div className="flex flex-col gap-4 p-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Auto B-roll</span>
				<Badge variant="outline" className="text-[8px] px-1 py-0">
					Local · CLIP
				</Badge>
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Matches each transcript segment to your own footage by visual similarity,
				then inserts the best clip as an overlay. All matching runs on-device
				against the local CLIP index — your media never leaves your machine.
			</p>

			{/* Index status */}
			<div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
				<div className="flex flex-col">
					<span className="text-[10px] font-medium">Footage index</span>
					<span className="text-[9px] text-muted-foreground">
						{indexedCount}/{indexableAssets} assets indexed
					</span>
				</div>
				<button
					type="button"
					disabled={isRunning || indexableAssets === 0}
					onClick={indexAll}
					className={cn(
						"rounded-md px-2 py-1 text-[9px] font-medium transition-colors",
						isRunning || indexableAssets === 0
							? "bg-muted text-muted-foreground cursor-not-allowed"
							: "bg-secondary hover:bg-secondary/80",
					)}
				>
					{isRunning ? "Indexing…" : "Index footage"}
				</button>
			</div>

			{indexedCount === 0 && indexableAssets > 0 && (
				<div className="flex items-start gap-1 rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-1.5">
					<span className="text-[9px] text-blue-700 dark:text-blue-400 leading-relaxed">
						Indexing samples one frame every ~2s per asset and embeds it. It runs
						once, then B-roll matching is instant. CLIP model is ~340MB on first run.
					</span>
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">
					Match threshold: {threshold.toFixed(2)}
				</Label>
				<input
					type="range"
					min={0.1}
					max={0.4}
					step={0.02}
					value={threshold}
					disabled={isRunning}
					onChange={(e) => setThreshold(Number(e.target.value))}
					className="w-full accent-primary h-1"
				/>
				<span className="text-[8px] text-muted-foreground">
					Lower = more matches (looser). Higher = fewer, more confident.
				</span>
			</div>

			<label className="flex items-center gap-1.5 cursor-pointer">
				<input
					type="checkbox"
					checked={autoApply}
					disabled={isRunning}
					onChange={(e) => setAutoApply(e.target.checked)}
					className="size-3 accent-primary"
				/>
				<span className="text-[10px] text-muted-foreground">
					Auto-apply best match to each segment
				</span>
			</label>

			{progress && isRunning && (
				<div className="flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 p-2">
					<div className="flex items-center justify-between">
						<span className="text-[9px] font-medium capitalize">{progress.phase}…</span>
						{progress.total > 0 && (
							<span className="text-[9px] text-muted-foreground">
								{progress.current}/{progress.total}
							</span>
						)}
					</div>
				</div>
			)}

			<button
				type="button"
				disabled={isRunning || indexedCount === 0 || segments.length === 0}
				onClick={handleRun}
				className={cn(
					"w-full rounded-md py-2 text-xs font-medium transition-colors",
					isRunning || indexedCount === 0 || segments.length === 0
						? "bg-muted text-muted-foreground cursor-not-allowed"
						: "bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				{isRunning ? "Matching…" : "Generate B-roll Suggestions"}
			</button>

			{/* Results: per-segment matches, reviewable */}
			{result && result.suggestions.length > 0 && !autoApply && (
				<div className="flex flex-col gap-2 mt-1">
					<div className="flex items-center justify-between">
						<span className="text-[10px] font-medium">
							{result.matched}/{result.suggestions.length} segments matched
						</span>
					</div>
					<div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
						{result.suggestions.map((s) => (
							<SuggestionRow
								key={s.segmentIndex}
								suggestion={s}
								onApply={(match) => {
									applyMatch(match, s.start, s.end);
									toast.success("B-roll added");
								}}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function SuggestionRow({
	suggestion,
	onApply,
}: {
	suggestion: BRollSuggestion;
	onApply: (m: BRollSuggestion["matches"][number]) => void;
}) {
	if (suggestion.matches.length === 0) return null;
	return (
		<div className="rounded-md border border-border p-2 flex flex-col gap-1.5">
			<div className="flex items-center gap-1.5">
				<Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">
					{suggestion.start.toFixed(1)}s
				</Badge>
				<span className="text-[9px] text-muted-foreground truncate flex-1">
					{suggestion.text.slice(0, 60)}
				</span>
			</div>
			<div className="flex flex-col gap-1">
				{suggestion.matches.slice(0, 3).map((m, i) => (
					<button
						key={`${m.mediaId}-${m.timestampSec}-${i}`}
						type="button"
						onClick={() => onApply(m)}
						className="flex items-center gap-1.5 rounded border border-border hover:border-primary/40 hover:bg-accent px-1.5 py-1 transition-colors text-left"
					>
						{m.thumbnailUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={m.thumbnailUrl}
								alt=""
								className="size-8 rounded object-cover shrink-0"
							/>
						) : (
							<div className="size-8 rounded bg-muted shrink-0" />
						)}
						<div className="flex flex-col min-w-0 flex-1">
							<span className="text-[9px] truncate">{m.mediaName}</span>
							<span className="text-[8px] text-muted-foreground">
								@ {m.timestampSec.toFixed(1)}s · {Math.round(m.score * 100)}%
							</span>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
