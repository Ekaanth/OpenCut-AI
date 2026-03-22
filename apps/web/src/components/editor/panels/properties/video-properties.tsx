import type {
	ImageElement,
	StickerElement,
	VideoElement,
} from "@/types/timeline";
import { BlendingSection, TransformSection } from "./sections";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "./section";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";

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
			{element.type === "video" && (
				<SpeedSection element={element} trackId={trackId} />
			)}
			<BlendingSection element={element} trackId={trackId} />
		</div>
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
							onValueChange={([v]) => handleSpeedChange(Math.round(v * 100) / 100)}
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
								variant={Math.abs(currentRate - preset.value) < 0.01 ? "secondary" : "outline"}
								size="sm"
								className={cn(
									"h-6 px-2 text-[10px] min-w-0",
									Math.abs(currentRate - preset.value) < 0.01 && "ring-1 ring-primary",
								)}
								onClick={() => handleSpeedChange(preset.value)}
							>
								{preset.label}
							</Button>
						))}
					</div>
				</div>
			</SectionContent>
		</Section>
	);
}
