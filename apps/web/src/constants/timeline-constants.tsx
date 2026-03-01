import type { TTimelineViewState } from "@/types/project";
import type { BlendMode } from "@/types/rendering";
import type { TrackType, Transform } from "@/types/timeline";
import {
	Happy01Icon,
	MagicWand05Icon,
	MusicNote03Icon,
	TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OcVideoIcon } from "@opencut/ui/icons";

export const DEFAULT_TRANSFORM: Transform = {
	scale: 1,
	position: { x: 0, y: 0 },
	rotate: 0,
};

export const DEFAULT_OPACITY = 1;
export const DEFAULT_BLEND_MODE: BlendMode = "normal";
export const DEFAULT_BOOKMARK_COLOR = "#009dff";

export const TRACK_CONFIG: Record<
	TrackType,
	{
		background: string;
		height: number;
		defaultName: string;
		icon: React.ReactNode;
	}
> = {
	video: {
		background: "transparent",
		height: 60,
		defaultName: "Video track",
		icon: <OcVideoIcon className="text-muted-foreground size-4 shrink-0" />,
	},
	text: {
		background: "bg-[#5DBAA0]",
		height: 25,
		defaultName: "Text track",
		icon: (
			<HugeiconsIcon
				icon={TextIcon}
				className="text-muted-foreground size-4 shrink-0"
			/>
		),
	},
	audio: {
		background: "bg-[#8F5DBA]",
		height: 50,
		defaultName: "Audio track",
		icon: (
			<HugeiconsIcon
				icon={MusicNote03Icon}
				className="text-muted-foreground size-4 shrink-0"
			/>
		),
	},
	sticker: {
		background: "bg-[#BA5D7A]",
		height: 50,
		defaultName: "Sticker track",
		icon: (
			<HugeiconsIcon
				icon={Happy01Icon}
				className="text-muted-foreground size-4 shrink-0"
			/>
		),
	},
	effect: {
		background: "bg-[#5d93ba]",
		height: 25,
		defaultName: "Effect track",
		icon: (
			<HugeiconsIcon
				icon={MagicWand05Icon}
				className="text-muted-foreground size-4 shrink-0"
			/>
		),
	},
} as const;

export const TRACK_GAP = 4;

export const DRAG_THRESHOLD_PX = 5;

export const TIMELINE_CONSTANTS = {
	PIXELS_PER_SECOND: 50,
	DEFAULT_ELEMENT_DURATION: 5,
	PADDING_TOP_PX: 0,
	ZOOM_MIN: 0.1,
	ZOOM_MAX: 100,
	ZOOM_BUTTON_FACTOR: 1.7,
	ZOOM_ANCHOR_PLAYHEAD_THRESHOLD: 0.15,
} as const;

export const DEFAULT_TIMELINE_VIEW_STATE: TTimelineViewState = {
	zoomLevel: 1,
	scrollLeft: 0,
	playheadTime: 0,
};
