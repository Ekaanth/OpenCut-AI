import { useEffect, useState } from "react";
import { timelineTimeToSnappedPixels } from "@/lib/timeline";
import type { TimelineTrack } from "@/types/timeline";

interface UseSnapIndicatorPositionParams {
	snapPoint: { time: number } | null;
	zoomLevel: number;
	tracks: TimelineTrack[];
	timelineRef: React.RefObject<HTMLDivElement | null>;
	trackLabelsRef?: React.RefObject<HTMLDivElement | null>;
	tracksScrollRef: React.RefObject<HTMLDivElement | null>;
}

interface SnapIndicatorPosition {
	leftPosition: number;
	topPosition: number;
	height: number;
}

export function useSnapIndicatorPosition({
	snapPoint,
	zoomLevel,
	tracks,
	timelineRef,
	trackLabelsRef,
	tracksScrollRef,
}: UseSnapIndicatorPositionParams): SnapIndicatorPosition {
	const [scrollLeft, setScrollLeft] = useState(0);

	useEffect(() => {
		const tracksViewport = tracksScrollRef.current;

		if (!tracksViewport) return;

		const handleScroll = () => {
			setScrollLeft(tracksViewport.scrollLeft);
		};

		setScrollLeft(tracksViewport.scrollLeft);

		tracksViewport.addEventListener("scroll", handleScroll);
		return () => tracksViewport.removeEventListener("scroll", handleScroll);
	}, [tracksScrollRef]);

	const timelineContainerHeight = timelineRef.current?.offsetHeight || 400;
	const totalHeight = timelineContainerHeight - 8; // 8px padding from edges

	const trackLabelsWidth =
		tracks.length > 0 && trackLabelsRef?.current
			? trackLabelsRef.current.offsetWidth
			: 0;

	const timelinePosition = timelineTimeToSnappedPixels({
		time: snapPoint?.time ?? 0,
		zoomLevel,
	});
	const leftPosition = trackLabelsWidth + timelinePosition - scrollLeft;

	return {
		leftPosition,
		topPosition: 0,
		height: totalHeight,
	};
}
