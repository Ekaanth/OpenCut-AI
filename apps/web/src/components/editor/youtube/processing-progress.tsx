"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useYouTubeReelsStore } from "@/stores/youtube-reels-store";

const STEPS = [
	{ key: "downloading", label: "Downloading captions & audio" },
	{ key: "transcribing", label: "Transcribing (if no captions)" },
	{ key: "analyzing", label: "Detecting clips" },
	{ key: "scoring", label: "Scoring engagement" },
	{ key: "generating", label: "Generating reels" },
] as const;

export function ProcessingProgress() {
	const status = useYouTubeReelsStore((s) => s.jobStatus);
	const progress = useYouTubeReelsStore((s) => s.jobProgress);
	const message = useYouTubeReelsStore((s) => s.jobMessage);
	const cancel = useYouTubeReelsStore((s) => s.cancelJob);

	const currentIdx = STEPS.findIndex((s) => s.key === status);

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				{STEPS.map((step, i) => {
					const isActive = step.key === status;
					const isDone = i < currentIdx;

					return (
						<div key={step.key} className="flex items-center gap-2 text-sm">
							<div className="flex h-5 w-5 items-center justify-center">
								{isActive ? (
									<Spinner className="h-4 w-4" />
								) : isDone ? (
									<span className="text-green-400 text-xs">&#10003;</span>
								) : (
									<span className="h-2 w-2 rounded-full bg-muted" />
								)}
							</div>
							<span className={isActive ? "text-foreground font-medium" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"}>
								{step.label}
							</span>
						</div>
					);
				})}
			</div>

			{/* Progress bar */}
			<div className="space-y-1">
				<div className="h-2 w-full rounded-full bg-muted overflow-hidden">
					<div
						className="h-full rounded-full bg-primary transition-all duration-500"
						style={{ width: `${Math.round(progress * 100)}%` }}
					/>
				</div>
				<p className="text-xs text-muted-foreground">{message}</p>
			</div>

			<Button variant="ghost" size="sm" onClick={() => { cancel().catch(() => {}); }}>
				Cancel
			</Button>
		</div>
	);
}
