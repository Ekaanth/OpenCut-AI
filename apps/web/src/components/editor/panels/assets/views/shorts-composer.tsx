"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { Film02Icon } from "@hugeicons/core-free-icons";
import { useShortsComposer } from "@/hooks/use-shorts-composer";
import { useTranscriptStore } from "@/stores/transcript-store";

const FORMAT_OPTIONS = [
	{ value: "9:16", label: "9:16 (TikTok/Reels)", width: 1080, height: 1920 },
	{ value: "1:1", label: "1:1 (Instagram)", width: 1080, height: 1080 },
	{ value: "4:5", label: "4:5 (Instagram Feed)", width: 1080, height: 1350 },
] as const;

export function ShortsComposerPanel({ className }: { className?: string }) {
	const { compose } = useShortsComposer();
	const segments = useTranscriptStore((s) => s.segments);
	const [duration, setDuration] = useState(60);
	const [format, setFormat] = useState<"9:16" | "1:1" | "4:5">("9:16");
	const [subtitles, setSubtitles] = useState(true);
	const [broll, setBroll] = useState(true);
	const [isComposing, setIsComposing] = useState(false);

	const hasTranscript = segments.length > 0;

	const handleCompose = useCallback(async () => {
		setIsComposing(true);
		try {
			await compose({
				targetDuration: duration,
				format,
				addSubtitles: subtitles,
				addBroll: broll,
				subtitleStyle: "karaoke",
				applyBrandKit: true,
			});
		} finally {
			setIsComposing(false);
		}
	}, [compose, duration, format, subtitles, broll]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Film02Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Auto-Compose Short</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					One-click: AI selects best clip, adds subtitles, B-roll, brand kit.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1">
				{!hasTranscript ? (
					<div className="text-center py-8">
						<p className="text-sm text-muted-foreground">
							Transcribe your video first to auto-compose a short.
						</p>
					</div>
				) : (
					<>
						<div className="space-y-1.5">
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>Target Duration</span>
								<span className="font-mono">{duration}s</span>
							</div>
							<Slider
								value={[duration]}
								onValueChange={([v]) => setDuration(v)}
								min={15}
								max={180}
								step={5}
							/>
						</div>

						<div className="space-y-1.5">
							<span className="text-[10px] text-muted-foreground">Format</span>
							<div className="grid grid-cols-3 gap-1">
								{FORMAT_OPTIONS.map((opt) => (
									<Button
										key={opt.value}
										variant={format === opt.value ? "secondary" : "outline"}
										size="sm"
										className="h-auto py-1.5 text-[9px] flex flex-col"
										onClick={() => setFormat(opt.value)}
									>
										<span>{opt.value}</span>
										<span className="text-[7px] text-muted-foreground">
											{opt.width}x{opt.height}
										</span>
									</Button>
								))}
							</div>
						</div>

						<div className="flex gap-2">
							<Button
								variant={subtitles ? "secondary" : "ghost"}
								size="sm"
								className="flex-1 h-7 text-[9px]"
								onClick={() => setSubtitles(!subtitles)}
							>
								Subtitles {subtitles ? "On" : "Off"}
							</Button>
							<Button
								variant={broll ? "secondary" : "ghost"}
								size="sm"
								className="flex-1 h-7 text-[9px]"
								onClick={() => setBroll(!broll)}
							>
								B-Roll {broll ? "On" : "Off"}
							</Button>
						</div>

						<Button
							className="w-full"
							onClick={handleCompose}
							disabled={isComposing}
						>
							{isComposing ? "Composing..." : `Compose ${duration}s ${format} Short`}
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
