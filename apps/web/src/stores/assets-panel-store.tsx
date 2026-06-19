import type { ElementType } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	ClosedCaptionIcon,
	Folder03Icon,
	HeadphonesIcon,
	MagicWand05Icon,
	TextIcon,
	Settings01Icon,
	SparklesIcon,
	Happy01Icon,
	CrownIcon,
	VideoReplayIcon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export const TAB_KEYS = [
	"media",
	"ai",
	"videogen",
	"text",
	"captions",
	"audio",
	"elements",
	"visuals",
	"search",
	"brandkit",
	"settings",
] as const;

export type Tab = (typeof TAB_KEYS)[number];

const createHugeiconsIcon =
	({ icon }: { icon: IconSvgElement }) =>
	({ className }: { className?: string }) => (
		<HugeiconsIcon icon={icon} className={className} />
	);

export const tabs = {
	media: {
		icon: createHugeiconsIcon({ icon: Folder03Icon }),
		label: "Media",
	},
	ai: {
		icon: createHugeiconsIcon({ icon: SparklesIcon }),
		label: "AI Studio",
	},
	videogen: {
		icon: createHugeiconsIcon({ icon: VideoReplayIcon }),
		label: "Video Gen",
	},
	text: {
		icon: createHugeiconsIcon({ icon: TextIcon }),
		label: "Text",
	},
	captions: {
		icon: createHugeiconsIcon({ icon: ClosedCaptionIcon }),
		label: "Captions",
	},
	audio: {
		icon: createHugeiconsIcon({ icon: HeadphonesIcon }),
		label: "Audio",
	},
	elements: {
		icon: createHugeiconsIcon({ icon: Happy01Icon }),
		label: "Elements",
	},
	visuals: {
		icon: createHugeiconsIcon({ icon: MagicWand05Icon }),
		label: "Visuals",
	},
	search: {
		icon: createHugeiconsIcon({ icon: Search01Icon }),
		label: "Search",
	},
	brandkit: {
		icon: createHugeiconsIcon({ icon: CrownIcon }),
		label: "Brand Kit",
	},
	settings: {
		icon: createHugeiconsIcon({ icon: Settings01Icon }),
		label: "Settings",
	},
} satisfies Record<
	Tab,
	{ icon: ElementType<{ className?: string }>; label: string }
>;

export type MediaViewMode = "grid" | "list";
export type MediaSortKey = "name" | "type" | "duration" | "size";
export type MediaSortOrder = "asc" | "desc";
export type MediaTypeFilter = "all" | "video" | "image" | "audio";

interface AssetsPanelStore {
	activeTab: Tab;
	setActiveTab: (tab: Tab) => void;
	highlightMediaId: string | null;
	requestRevealMedia: (mediaId: string) => void;
	clearHighlight: () => void;

	/* Media */
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	mediaSortBy: MediaSortKey;
	mediaSortOrder: MediaSortOrder;
	setMediaSort: (key: MediaSortKey, order: MediaSortOrder) => void;
	mediaTypeFilter: MediaTypeFilter;
	setMediaTypeFilter: (filter: MediaTypeFilter) => void;
}

export const useAssetsPanelStore = create<AssetsPanelStore>()(
	persist(
		(set) => ({
			activeTab: "media",
			setActiveTab: (tab) => set({ activeTab: tab }),
			highlightMediaId: null,
			requestRevealMedia: (mediaId) =>
				set({ activeTab: "media", highlightMediaId: mediaId }),
			clearHighlight: () => set({ highlightMediaId: null }),
			mediaViewMode: "grid",
			setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
			mediaSortBy: "name",
			mediaSortOrder: "asc",
			setMediaSort: (key, order) =>
				set({ mediaSortBy: key, mediaSortOrder: order }),
			mediaTypeFilter: "all",
			setMediaTypeFilter: (filter) => set({ mediaTypeFilter: filter }),
		}),
		{
			name: "assets-panel",
			partialize: (state) => ({
				mediaViewMode: state.mediaViewMode,
				mediaSortBy: state.mediaSortBy,
				mediaSortOrder: state.mediaSortOrder,
				mediaTypeFilter: state.mediaTypeFilter,
			}),
		},
	),
);
