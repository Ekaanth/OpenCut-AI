"use client";

import { SubTabView } from "./sub-tab-view";
import { StickersView } from "./stickers";
import { OverlaysView } from "./overlays";

export function ElementsCombinedView() {
	return (
		<SubTabView
			tabs={[
				{ key: "stickers", label: "Stickers", content: <StickersView /> },
				{ key: "overlays", label: "Overlays", content: <OverlaysView /> },
			]}
		/>
	);
}
