"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { buildSpeakerCaptionSegments, getSpeakerColor } from "@/lib/transcription/speaker-captions";
import { toast } from "sonner";

export function SpeakerCaptionsPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
	const [selectedColorScheme, setSelectedColorScheme] = useState(0);

	const captionSegments = useMemo(
		() => buildSpeakerCaptionSegments(segments, speakerNames),
		[segments, speakerNames],
	);

	const uniqueSpeakers = useMemo(() => {
		const seen = new Map<string, { index: number; color: string }>();
		for (const seg of captionSegments) {
			if (!seen.has(seg.speaker)) {
				seen.set(seg.speaker, { index: seg.speakerIndex, color: seg.speakerColor });
			}
		}
		return Array.from(seen.entries()).map(([speaker, info]) => ({
			speaker,
			...info,
		}));
	}, [captionSegments]);

	const handleRenameSpeaker = useCallback(
		(speaker: string, name: string) => {
			setSpeakerNames((prev) => ({ ...prev, [speaker]: name }));
		},
		[],
	);

	const handleApplyToTimeline = useCallback(() => {
		if (captionSegments.length === 0) {
			toast.error("No caption segments to apply");
			return;
		}

		for (const seg of captionSegments) {
			const element = {
				type: "text" as const,
				content: `[${seg.speakerLabel}]\n${seg.text}`,
				name: `${seg.speakerLabel} — ${seg.text.slice(0, 20)}...`,
				startTime: seg.start,
				duration: seg.end - seg.start,
				trimStart: 0,
				trimEnd: 0,
				fontSize: 24,
				fontFamily: "Inter",
				color: seg.speakerColor,
				highlightColor: "#FFFFFF",
				background: {
					enabled: true,
					color: "#000000",
					cornerRadius: 4,
					paddingX: 8,
					paddingY: 4,
				},
				textAlign: "center" as const,
				fontWeight: "bold" as const,
				fontStyle: "normal" as const,
				textDecoration: "none" as const,
				transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
				opacity: 1,
			};

			editor.timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		}

		toast.success(`Applied ${captionSegments.length} speaker-labeled captions`);
	}, [captionSegments, editor]);

	if (segments.length === 0) {
		return (
			<div className={cn("p-4 text-center", className)}>
				<p className="text-sm text-muted-foreground">
					Transcribe your video first to enable speaker captions.
				</p>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium">Speaker Captions</span>
					<Badge variant="secondary" className="text-[8px] px-1 py-0">
						{uniqueSpeakers.length} speakers
					</Badge>
				</div>
			</div>

			<div className="px-4 py-3 space-y-3 border-b">
				{uniqueSpeakers.map(({ speaker, index, color }) => (
					<div key={speaker} className="flex items-center gap-2">
						<div
							className="size-4 rounded-full shrink-0 border"
							style={{ backgroundColor: color }}
						/>
						<Input
							className="h-7 text-[10px]"
							value={speakerNames[speaker] ?? `Speaker ${index + 1}`}
							onChange={(e) => handleRenameSpeaker(speaker, e.target.value)}
							placeholder={`Speaker ${index + 1}`}
						/>
					</div>
				))}
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-1">
					{captionSegments.map((seg, idx) => (
						<div
							key={idx}
							className="rounded border p-2 space-y-1"
							style={{ borderLeftColor: seg.speakerColor, borderLeftWidth: 3 }}
						>
							<div className="flex items-center gap-1.5">
								<span
									className="text-[9px] font-medium"
									style={{ color: seg.speakerColor }}
								>
									{seg.speakerLabel}
								</span>
								<span className="text-[8px] text-muted-foreground font-mono">
									{seg.start.toFixed(1)}s — {seg.end.toFixed(1)}s
								</span>
							</div>
							<p className="text-[10px] text-muted-foreground">{seg.text}</p>
						</div>
					))}
				</div>
			</ScrollArea>

			<div className="px-4 py-3 border-t">
				<Button size="sm" className="w-full" onClick={handleApplyToTimeline}>
					Apply {captionSegments.length} Speaker Captions to Timeline
				</Button>
			</div>
		</div>
	);
}
