"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/stores/assets-panel-store";
import { TabBar } from "./tabbar";
import { AIStudioView } from "./views/ai-studio";
import { Captions } from "./views/captions";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { TextView } from "./views/text";
import { AudioCombinedView } from "./views/audio-combined";
import { ElementsCombinedView } from "./views/elements-combined";
import { VisualsCombinedView } from "./views/visuals-combined";
import { BrandKitView } from "./views/brand-kit";
import { VideoGenerationPanel } from "./views/video-generation";
import { VisualSearchView } from "./views/visual-search";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		media: <MediaView />,
		ai: <AIStudioView />,
		videogen: <VideoGenerationPanel />,
		text: <TextView />,
		captions: <Captions />,
		audio: <AudioCombinedView />,
		elements: <ElementsCombinedView />,
		visuals: <VisualsCombinedView />,
		search: <VisualSearchView />,
		brandkit: <BrandKitView />,
		settings: <SettingsView />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
