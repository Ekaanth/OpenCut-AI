"use client";

import { timelineTimeToSnappedPixels } from "@/lib/timeline";
import { formatRulerLabel } from "@/lib/timeline/ruler-utils";

interface TimelineTickProps {
	time: number;
	zoomLevel: number;
	fps: number;
	showLabel: boolean;
}

export function TimelineTick({
	time,
	zoomLevel,
	fps,
	showLabel,
}: TimelineTickProps) {
	const leftPosition = timelineTimeToSnappedPixels({ time, zoomLevel });

	if (showLabel) {
		const label = formatRulerLabel({ timeInSeconds: time, fps });
		return (
			<span
				className="text-muted-foreground/85 absolute bottom-0 select-none text-[10px] leading-none"
				style={{ left: `${leftPosition}px` }}
			>
				{label}
			</span>
		);
	}

	return (
		<div
			className="border-muted-foreground/25 absolute bottom-0.5 h-1.5 border-l"
			style={{ left: `${leftPosition}px` }}
		/>
	);
}
