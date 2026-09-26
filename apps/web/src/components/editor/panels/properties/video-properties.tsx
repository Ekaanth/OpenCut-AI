import { useState } from "react";
import type {
	ImageElement,
	StickerElement,
	VideoElement,
	VideoTrack,
} from "@/types/timeline";
import { BlendingSection, TransformSection } from "./sections";
import { CropMaskSection } from "./sections/crop-mask";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "./section";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { SpeedCurveEditor } from "./speed-curve-editor";
import { aiClient } from "@/lib/ai-client";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { mediaSupportsAudio } from "@/lib/media/media-utils";
import { toast } from "sonner";

export function VideoProperties({
	element,
	trackId,
}: {
	element: VideoElement | ImageElement | StickerElement;
	trackId: string;
}) {
	return (
		<div className="flex h-full flex-col">
			<TransformSection
				element={element}
				trackId={trackId}
				showTopBorder={false}
			/>
			<CropMaskSection element={element} trackId={trackId} />
			{element.type === "video" && (
				<SpeedSection element={element} trackId={trackId} />
			)}
			{element.type === "video" && (
				<EnhanceAudioSection element={element} trackId={trackId} />
			)}
			<BlendingSection element={element} trackId={trackId} />
		</div>
	);
}

/** Denoises this video clip's own audio: mutes the original, adds the
 * cleaned copy as a new audio track synced to the same start/duration. */
function EnhanceAudioSection({
	element,
	trackId,
}: {
	element: VideoElement;
	trackId: string;
}) {
	const editor = useEditor();
	const [strength, setStrength] = useState(0.7);
	const [isProcessing, setIsProcessing] = useState(false);

	const mediaAsset = editor.media
		.getAssets()
		.find((asset) => asset.id === element.mediaId);
	if (!mediaSupportsAudio({ media: mediaAsset })) return null;

	const handleEnhance = async () => {
		setIsProcessing(true);
		try {
			// Isolate this clip's audio by decoding it on its own synthetic track.
			const soloTrack: VideoTrack = {
				id: "solo-enhance",
				name: "solo",
				type: "video",
				elements: [{ ...element, startTime: 0 }],
				isMain: false,
				muted: false,
				hidden: false,
			};

			const wavBlob = await extractTimelineAudio({
				tracks: [soloTrack],
				mediaAssets: editor.media.getAssets(),
				totalDuration: element.duration,
			});

			const file = new File([wavBlob], "clip-audio.wav", {
				type: "audio/wav",
			});
			const denoisedBlob = await aiClient.denoiseAudio(file, strength);
			const audioUrl = URL.createObjectURL(denoisedBlob);

			editor.timeline.updateElements({
				updates: [
					{ trackId, elementId: element.id, updates: { muted: true } },
				],
			});

			const audioTrackId = editor.timeline.addTrack({
				type: "audio",
				index: 0,
			});
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: audioTrackId },
				element: {
					type: "audio",
					sourceType: "library",
					sourceUrl: audioUrl,
					name: `Enhanced: ${element.name}`,
					startTime: element.startTime,
					duration: element.duration,
					trimStart: 0,
					trimEnd: 0,
					sourceDuration: element.duration,
					volume: 1,
				},
			});

			toast.success("Voice enhanced. Original muted, cleaned audio added.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Voice enhance failed");
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Section collapsible sectionKey="video:enhance-audio">
			<SectionHeader>
				<SectionTitle>Voice Enhance</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Slider
							value={[strength]}
							onValueChange={([v]) => setStrength(v)}
							min={0}
							max={1}
							step={0.05}
						/>
						<div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
							<span>None</span>
							<span>Max</span>
						</div>
					</div>
					<Button
						size="sm"
						className="w-full h-7 text-[11px]"
						onClick={handleEnhance}
						disabled={isProcessing}
					>
						{isProcessing && <Spinner className="size-3 mr-1" />}
						Enhance voice
					</Button>
					<p className="text-[9px] text-muted-foreground">
						Removes background noise from this clip&apos;s audio. Mutes the
						original, adds the cleaned audio as a new track.
					</p>
				</div>
			</SectionContent>
		</Section>
	);
}

const SPEED_PRESETS = [
	{ label: "0.25x", value: 0.25 },
	{ label: "0.5x", value: 0.5 },
	{ label: "0.75x", value: 0.75 },
	{ label: "1x", value: 1.0 },
	{ label: "1.25x", value: 1.25 },
	{ label: "1.5x", value: 1.5 },
	{ label: "2x", value: 2.0 },
	{ label: "3x", value: 3.0 },
];

function SpeedSection({
	element,
	trackId,
}: {
	element: VideoElement;
	trackId: string;
}) {
	const editor = useEditor();
	const currentRate = element.playbackRate ?? 1.0;

	const handleSpeedChange = (rate: number) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { playbackRate: rate },
				},
			],
		});
	};

	return (
		<Section collapsible sectionKey="video:speed">
			<SectionHeader>
				<SectionTitle>Speed</SectionTitle>
				<span className="text-[10px] text-muted-foreground tabular-nums mr-2">
					{currentRate === 1 ? "Normal" : `${currentRate}x`}
				</span>
			</SectionHeader>
			<SectionContent>
				<div className="flex flex-col gap-3">
					{/* Slider */}
					<div className="flex flex-col gap-1.5">
						<Slider
							value={[currentRate]}
							onValueChange={([v]) =>
								handleSpeedChange(Math.round(v * 100) / 100)
							}
							min={0.1}
							max={4.0}
							step={0.05}
						/>
						<div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
							<span>0.1x</span>
							<span>1x</span>
							<span>4x</span>
						</div>
					</div>

					{/* Preset buttons */}
					<div className="flex flex-wrap gap-1">
						{SPEED_PRESETS.map((preset) => (
							<Button
								key={preset.value}
								variant={
									Math.abs(currentRate - preset.value) < 0.01
										? "secondary"
										: "outline"
								}
								size="sm"
								className={cn(
									"h-6 px-2 text-[10px] min-w-0",
									Math.abs(currentRate - preset.value) < 0.01 &&
										"ring-1 ring-primary",
								)}
								onClick={() => handleSpeedChange(preset.value)}
							>
								{preset.label}
							</Button>
						))}
					</div>

					{/* Speed Curve Editor */}
					<SpeedCurveEditor element={element} trackId={trackId} />
				</div>
			</SectionContent>
		</Section>
	);
}
