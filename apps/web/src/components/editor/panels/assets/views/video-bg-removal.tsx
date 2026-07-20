"use client";

import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useVideoBgRemoval } from "@/hooks/use-video-bg-removal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

const FPS_PRESETS = [
	{ value: 4, label: "4 fps", note: "Fastest · coarsest" },
	{ value: 8, label: "8 fps", note: "Balanced (default)" },
	{ value: 12, label: "12 fps", note: "Smoother · slower" },
	{ value: 15, label: "15 fps", note: "Best · GPU recommended" },
];

export function VideoBgRemovalPanel() {
	const editor = useEditor();
	const { run, isRunning, progress } = useVideoBgRemoval();

	const [fps, setFps] = useState(8);
	const [maxDuration, setMaxDuration] = useState(60);
	const [nonDestructive, setNonDestructive] = useState(true);

	// Detect whether a usable source clip is selected/existing.
	const tracks = editor.timeline.getTracks();
	const hasVideoClip = tracks.some(
		(t) => t.type === "video" && t.elements.some((e) => "mediaId" in e && e.mediaId),
	);

	const handleRun = useCallback(() => {
		if (!hasVideoClip) {
			toast.error("Add a video clip to the timeline first.");
			return;
		}
		run({ fps, maxDuration, nonDestructive });
	}, [hasVideoClip, run, fps, maxDuration, nonDestructive]);

	const pct = Math.round((progress?.progress ?? 0) * 100);

	return (
		<div className="flex flex-col gap-4 p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-medium">Video BG Removal</span>
				</div>
				<Badge variant="outline" className="text-[8px] px-1 py-0">
					Local · rembg
				</Badge>
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Remove the background from any video clip — no green screen needed.
				Runs per-frame with rembg, fully on your machine. Result is added as a
				new transparent clip above the source.
			</p>

			<div className="flex items-start gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
				<svg className="size-3 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
					<path d="M8 2C4.7 2 2 4.7 2 8s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 3v3m0 2.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
				</svg>
				<span className="text-[9px] text-amber-700 dark:text-amber-400 leading-relaxed">
					Per-frame rembg is slow on CPU (~1s/frame). Keep clips short, or use a
					GPU host. You'll see a time estimate before it starts.
				</span>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">Sampling rate</Label>
				<div className="grid grid-cols-2 gap-1">
					{FPS_PRESETS.map((p) => (
						<button
							key={p.value}
							type="button"
							disabled={isRunning}
							onClick={() => setFps(p.value)}
							className={cn(
								"flex flex-col items-start rounded-md border px-2 py-1 text-left transition-colors",
								fps === p.value
									? "border-primary/40 bg-primary/5"
									: "border-border hover:bg-accent",
								isRunning && "opacity-50 cursor-not-allowed",
							)}
						>
							<span className="text-[10px] font-medium">{p.label}</span>
							<span className="text-[8px] text-muted-foreground">{p.note}</span>
						</button>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">
					Max duration: {maxDuration}s
				</Label>
				<input
					type="range"
					min={10}
					max={120}
					step={5}
					value={maxDuration}
					disabled={isRunning}
					onChange={(e) => setMaxDuration(Number(e.target.value))}
					className="w-full accent-primary h-1"
				/>
			</div>

			<label className="flex items-center gap-1.5 cursor-pointer">
				<input
					type="checkbox"
					checked={nonDestructive}
					disabled={isRunning}
					onChange={(e) => setNonDestructive(e.target.checked)}
					className="size-3 accent-primary"
				/>
				<span className="text-[10px] text-muted-foreground">
					Non-destructive (add new clip above source)
				</span>
			</label>

			{progress && isRunning && (
				<div className="flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 p-2">
					<div className="flex items-center justify-between">
						<span className="text-[9px] font-medium capitalize">
							{progress.phase === "extracting"
								? "Extracting frames…"
								: progress.phase === "processing"
									? "Removing backgrounds…"
									: progress.phase === "encoding"
										? "Encoding transparent video…"
										: "Working…"}
						</span>
						<span className="text-[9px] text-muted-foreground">
							{progress.totalFrames
								? `${progress.processedFrames}/${progress.totalFrames}`
								: ""}
						</span>
					</div>
					<div className="w-full bg-muted rounded-full h-1">
						<div
							className="bg-primary h-1 rounded-full transition-all"
							style={{ width: `${pct}%` }}
						/>
					</div>
					<span className="text-[8px] text-muted-foreground truncate">
						{progress.message}
					</span>
				</div>
			)}

			<button
				type="button"
				disabled={isRunning || !hasVideoClip}
				onClick={handleRun}
				className={cn(
					"w-full rounded-md py-2 text-xs font-medium transition-colors",
					isRunning
						? "bg-muted text-muted-foreground cursor-not-allowed"
						: "bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				{isRunning ? "Processing…" : "Remove Background"}
			</button>
		</div>
	);
}
