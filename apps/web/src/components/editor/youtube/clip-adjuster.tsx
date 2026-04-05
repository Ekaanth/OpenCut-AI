"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ScoredClipData } from "@/lib/ai-client";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 10);
	return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

interface ClipAdjusterProps {
	clip: ScoredClipData;
	onSave: (start: number, end: number) => void;
	onCancel: () => void;
}

export function ClipAdjuster({ clip, onSave, onCancel }: ClipAdjusterProps) {
	const [start, setStart] = useState(clip.start);
	const [end, setEnd] = useState(clip.end);
	const duration = end - start;

	const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		if (!isNaN(val) && val >= 0 && val < end) setStart(val);
	};

	const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		if (!isNaN(val) && val > start) setEnd(val);
	};

	const durationWarning = duration < 15 ? "Too short (min 15s)" : duration > 90 ? "Too long (max 90s)" : null;

	return (
		<div className="space-y-3 p-3 rounded-lg border bg-card">
			<h4 className="text-xs font-semibold">Adjust Clip Boundaries</h4>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<label className="text-[10px] text-muted-foreground">Start</label>
					<input
						type="number"
						step="0.5"
						value={start.toFixed(1)}
						onChange={handleStartChange}
						className="w-full rounded border bg-background px-2 py-1 text-xs"
					/>
					<span className="text-[10px] text-muted-foreground">{formatTime(start)}</span>
				</div>
				<div className="space-y-1">
					<label className="text-[10px] text-muted-foreground">End</label>
					<input
						type="number"
						step="0.5"
						value={end.toFixed(1)}
						onChange={handleEndChange}
						className="w-full rounded border bg-background px-2 py-1 text-xs"
					/>
					<span className="text-[10px] text-muted-foreground">{formatTime(end)}</span>
				</div>
			</div>

			<div className="flex items-center justify-between text-xs">
				<span>Duration: {Math.round(duration)}s</span>
				{durationWarning && (
					<span className="text-yellow-400 text-[10px]">{durationWarning}</span>
				)}
			</div>

			<div className="flex gap-2 justify-end">
				<Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
					Cancel
				</Button>
				<Button size="sm" className="text-xs" onClick={() => onSave(start, end)} disabled={!!durationWarning}>
					Save
				</Button>
			</div>
		</div>
	);
}
