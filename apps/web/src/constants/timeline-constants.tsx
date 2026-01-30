import type { TTimelineViewState } from "@/types/project";
import type { TrackType } from "@/types/timeline";
import {
	Happy01Icon,
	MusicNote03Icon,
	TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OcVideoIcon } from "@opencut/ui/icons";

export const TRACK_COLORS: Record<TrackType, { background: string }> = {
	video: {
		background: "transparent",
	},
	text: {
		background: "bg-[#5DBAA0]",
	},
	audio: {
		background: "bg-[#915DBE]",
	},
	sticker: {
		background: "bg-amber-500",
	},
} as const;

export const TRACK_HEIGHTS: Record<TrackType, number> = {
	video: 60,
	text: 25,
	audio: 50,
	sticker: 50,
} as const;

export const TRACK_GAP = 4;

export const TIMELINE_CONSTANTS = {
	PIXELS_PER_SECOND: 50,
	DEFAULT_ELEMENT_DURATION: 5,
	PLAYHEAD_LOOKAHEAD_SECONDS: 30, // padding ahead
	PADDING_TOP_PX: 0,
	ZOOM_LEVELS: [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 15, 20, 30, 50],
	ZOOM_MIN: 0.1,
	ZOOM_MAX: 100,
	ZOOM_STEP: 0.1,
} as const;

export const DEFAULT_TIMELINE_VIEW_STATE: TTimelineViewState = {
	zoomLevel: 1,
	scrollLeft: 0,
	playheadTime: 0,
};

export const TRACK_ICONS: Record<TrackType, React.ReactNode> = {
	video: <OcVideoIcon className="text-muted-foreground size-4 shrink-0" />,
	text: (
		<HugeiconsIcon
			icon={TextIcon}
			className="text-muted-foreground size-4 shrink-0"
		/>
	),
	audio: (
		<HugeiconsIcon
			icon={MusicNote03Icon}
			className="text-muted-foreground size-4 shrink-0"
		/>
	),
	sticker: (
		<HugeiconsIcon
			icon={Happy01Icon}
			className="text-muted-foreground size-4 shrink-0"
		/>
	),
} as const;
