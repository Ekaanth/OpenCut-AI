"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/stores/assets-panel-store";
import { TabBar } from "./tabbar";
import { AIStudioView } from "./views/ai-studio";
import { Captions } from "./views/captions";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { SoundsView } from "./views/sounds";
import { StickersView } from "./views/stickers";
import { TextView } from "./views/text";
import { EffectsView } from "./views/effects";
import { FactCheckView } from "./views/factcheck";
import { FiltersView } from "./views/filters";
import { AdjustmentView } from "./views/adjustment";
import { OverlaysView } from "./views/overlays";
import { VoiceoverView } from "./views/voiceover";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		ai: <AIStudioView />,
		media: <MediaView />,
		sounds: <SoundsView />,
		voiceover: <VoiceoverView />,
		text: <TextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		transitions: <OverlaysView />,
		captions: <Captions />,
		factcheck: <FactCheckView />,
		filters: <FiltersView />,
		adjustment: <AdjustmentView />,
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
