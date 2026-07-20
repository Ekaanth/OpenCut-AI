"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useEditBySpeaker, type SpeakerStats } from "@/hooks/use-edit-by-speaker";
import { useTranscriptStore } from "@/stores/transcript-store";
import { aiClient } from "@/lib/ai-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

/**
 * Find the first media-backed file on the timeline so we can run diarization
 * on it. Mirrors the lookup pattern from use-smart-cut.ts.
 */
function useFirstMediaFile(): File | null {
	const editor = useEditor();
	for (const track of editor.timeline.getTracks()) {
		for (const el of track.elements) {
			const mediaId = (el as { mediaId?: string }).mediaId;
			if (!mediaId) continue;
			const asset = editor.media.getAssets().find((a) => a.id === mediaId);
			if (asset?.file) return asset.file;
		}
	}
	return null;
}

export function EditBySpeakerPanel() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const speakerNames = useTranscriptStore((s) => s.speakerNames);
	const { getSpeakers, removeSpeaker, tightenSpeakerGaps, isolateSpeaker } =
		useEditBySpeaker();
	const mediaFile = useFirstMediaFile();

	const [speakers, setSpeakers] = useState<SpeakerStats[]>([]);
	const [isDetecting, setIsDetecting] = useState(false);
	const [busyFor, setBusyFor] = useState<string | null>(null);
	const [maxGap, setMaxGap] = useState(1.5);

	const refresh = useCallback(() => setSpeakers(getSpeakers()), [getSpeakers]);
	useEffect(() => {
		refresh();
	}, [refresh, segments, speakerNames]);

	const hasSpeakers = speakers.length > 0;

	const handleDetect = useCallback(async () => {
		if (!mediaFile) {
			toast.error("Add a media file to the timeline first.");
			return;
		}
		setIsDetecting(true);
		try {
			const result = await aiClient.analyzeSpeakers(mediaFile);
			useTranscriptStore.getState().applySpeakerDiarization(result.segments);
			toast.success(
				`Detected ${result.num_speakers} speaker${result.num_speakers === 1 ? "" : "s"}.`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Speaker detection failed";
			toast.error("Speaker detection failed", { description: msg });
		} finally {
			setIsDetecting(false);
		}
	}, [mediaFile]);

	const run = useCallback(
		async (speakerId: string, op: "remove" | "tighten" | "isolate") => {
			setBusyFor(`${speakerId}:${op}`);
			try {
				if (op === "remove") {
					if (
						!window.confirm(
							`Remove all segments by this speaker from the timeline? This cuts the underlying video/audio too. Undoable.`,
						)
					)
						return;
					await removeSpeaker(speakerId);
				} else if (op === "tighten") {
					await tightenSpeakerGaps(speakerId, maxGap);
				} else {
					isolateSpeaker(speakerId);
				}
				refresh();
			} finally {
				setBusyFor(null);
			}
		},
		[removeSpeaker, tightenSpeakerGaps, isolateSpeaker, maxGap, refresh],
	);

	return (
		<div className="flex flex-col gap-4 p-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Edit by Speaker</span>
				<Badge variant="outline" className="text-[8px] px-1 py-0">
					Local · diarization
				</Badge>
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Operate on a single speaker at a time — remove their segments (cuts the
				timeline too), tighten the gaps between their lines, or mute everything
				else to isolate them. Runs entirely on-device.
			</p>

			{!hasSpeakers && (
				<div className="flex flex-col gap-2 rounded-md border border-border p-3">
					<span className="text-[10px] text-muted-foreground">
						No speaker labels yet. Run detection to label each transcript segment
						with its speaker.
					</span>
					<button
						type="button"
						disabled={isDetecting || !mediaFile}
						onClick={handleDetect}
						className={cn(
							"rounded-md py-1.5 text-[10px] font-medium transition-colors",
							isDetecting || !mediaFile
								? "bg-muted text-muted-foreground cursor-not-allowed"
								: "bg-primary text-primary-foreground hover:bg-primary/90",
						)}
					>
						{isDetecting ? "Detecting…" : "Detect speakers"}
					</button>
				</div>
			)}

			{hasSpeakers && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<Label>Speakers</Label>
						<span className="text-[8px] text-muted-foreground">
							{speakers.length} found
						</span>
					</div>
					<div className="flex flex-col gap-2">
						{speakers.map((sp, idx) => (
							<SpeakerRow
								key={sp.id}
								speaker={sp}
								color={speakerColor(idx)}
								busy={busyFor?.startsWith(sp.id) ?? false}
								maxGap={maxGap}
								onMaxGap={setMaxGap}
								onRemove={() => run(sp.id, "remove")}
								onTighten={() => run(sp.id, "tighten")}
								onIsolate={() => run(sp.id, "isolate")}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function Label({ children }: { children: React.ReactNode }) {
	return <span className="text-[10px] font-medium">{children}</span>;
}

function SpeakerRow({
	speaker,
	color,
	busy,
	maxGap,
	onMaxGap,
	onRemove,
	onTighten,
	onIsolate,
}: {
	speaker: SpeakerStats;
	color: string;
	busy: boolean;
	maxGap: number;
	onMaxGap: (v: number) => void;
	onRemove: () => void;
	onTighten: () => void;
	onIsolate: () => void;
}) {
	return (
		<div className="rounded-md border border-border p-2 flex flex-col gap-2">
			<div className="flex items-center gap-1.5">
				<span
					className="size-2.5 rounded-full shrink-0"
					style={{ backgroundColor: color }}
				/>
				<span className="text-[10px] font-medium flex-1 truncate">
					{speaker.label}
				</span>
				<span className="text-[8px] text-muted-foreground">
					{speaker.segmentCount} seg · {speaker.totalSeconds.toFixed(1)}s
				</span>
			</div>

			<div className="flex items-center gap-1">
				<ActionButton onClick={onRemove} disabled={busy} tone="destructive">
					Remove
				</ActionButton>
				<ActionButton onClick={onTighten} disabled={busy}>
					Tighten
				</ActionButton>
				<ActionButton onClick={onIsolate} disabled={busy}>
					Isolate
				</ActionButton>
			</div>

			<label className="flex items-center gap-1 text-[8px] text-muted-foreground">
				<span>Max gap:</span>
				<input
					type="range"
					min={0.2}
					max={5}
					step={0.1}
					value={maxGap}
					onChange={(e) => onMaxGap(Number(e.target.value))}
					className="flex-1 accent-primary h-1"
					disabled={busy}
				/>
				<span className="w-6 text-right">{maxGap.toFixed(1)}s</span>
			</label>
		</div>
	);
}

function ActionButton({
	onClick,
	disabled,
	tone,
	children,
}: {
	onClick: () => void;
	disabled?: boolean;
	tone?: "destructive";
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex-1 rounded border px-1.5 py-1 text-[9px] font-medium transition-colors",
				disabled && "opacity-50 cursor-not-allowed",
				tone === "destructive"
					? "border-destructive/30 text-destructive hover:bg-destructive/10"
					: "border-border hover:bg-accent",
			)}
		>
			{children}
		</button>
	);
}

// Keep this in sync with lib/transcription/speaker-captions.ts SPEAKER_COLORS.
function speakerColor(index: number): string {
	const colors = [
		"#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3",
		"#C9B1FF", "#FFB7B2", "#B5EAD7", "#FF9F1C",
		"#A8DADC", "#F4A261",
	];
	return colors[index % colors.length];
}
