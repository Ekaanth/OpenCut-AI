import { useEditor } from "@/hooks/use-editor";
import { clamp } from "@/utils/math";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import {
	Section,
	SectionContent,
	SectionField,
	SectionHeader,
	SectionTitle,
} from "./section";
import { KeyframeToggle } from "./keyframe-toggle";
import { useKeyframedNumberProperty } from "./hooks/use-keyframed-number-property";
import { useElementPlayhead } from "./hooks/use-element-playhead";
import { resolveVolumeAtTime } from "@/lib/animation";
import { isPropertyAtDefault } from "./sections/transform";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	VolumeHighIcon,
	VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import type { AudioElement } from "@/types/timeline";

const DEFAULT_VOLUME = 1;

function volumeToDb(volume: number): string {
	if (volume <= 0) return "-inf";
	const db = 20 * Math.log10(volume);
	return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

export function AudioProperties({
	element,
	trackId,
}: {
	element: AudioElement;
	trackId: string;
}) {
	const editor = useEditor();
	const isMuted = element.muted === true;

	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});

	const resolvedVolume = resolveVolumeAtTime({
		baseVolume: element.volume,
		animations: element.animations,
		localTime,
	});

	const volume = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "volume",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedVolume * 100).toString(),
		parse: (input) => {
			const parsed = Number.parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min: 0, max: 200 }) / 100;
		},
		valueAtPlayhead: resolvedVolume,
		buildBaseUpdates: ({ value }) => ({ volume: value }),
	});

	const handleToggleMute = () => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { muted: !isMuted },
				},
			],
		});
	};

	return (
		<div className="flex h-full flex-col">
			<Section
				collapsible
				sectionKey="audio:volume"
				showTopBorder={false}
			>
				<SectionHeader>
					<SectionTitle>Volume</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<div className="flex items-start gap-2">
						<SectionField
							label="Level"
							className="flex-1"
							beforeLabel={
								<KeyframeToggle
									isActive={volume.isKeyframedAtTime}
									isDisabled={!isPlayheadWithinElementRange}
									title="Toggle volume keyframe"
									onToggle={volume.toggleKeyframe}
								/>
							}
						>
							<div className="flex items-center gap-2">
								<NumberField
									className="flex-1"
									icon={
										<HugeiconsIcon
											icon={VolumeHighIcon}
											className="size-3.5 text-muted-foreground"
										/>
									}
									value={volume.displayValue}
									min={0}
									max={200}
									onFocus={volume.onFocus}
									onChange={volume.onChange}
									onBlur={volume.onBlur}
									onScrub={volume.scrubTo}
									onScrubEnd={volume.commitScrub}
									onReset={() =>
										volume.commitValue({ value: DEFAULT_VOLUME })
									}
									isDefault={isPropertyAtDefault({
										hasAnimatedKeyframes: volume.hasAnimatedKeyframes,
										isPlayheadWithinElementRange,
										resolvedValue: resolvedVolume,
										staticValue: element.volume,
										defaultValue: DEFAULT_VOLUME,
									})}
									dragSensitivity="slow"
								/>
								<Button
									variant={isMuted ? "secondary" : "ghost"}
									size="icon"
									className="size-8 shrink-0"
									onClick={handleToggleMute}
									title={isMuted ? "Unmute" : "Mute"}
								>
									<HugeiconsIcon
										icon={isMuted ? VolumeOffIcon : VolumeHighIcon}
										className="size-4"
									/>
								</Button>
							</div>
						</SectionField>
					</div>

					<div className="text-muted-foreground mt-3 flex items-center justify-between text-xs tabular-nums">
						<span>
							{volumeToDb(resolvedVolume)} dB
						</span>
						<span>
							{Math.round(resolvedVolume * 100)}%
						</span>
					</div>
				</SectionContent>
			</Section>
		</div>
	);
}
