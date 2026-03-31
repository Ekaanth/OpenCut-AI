"use client";

import { SubTabView } from "./sub-tab-view";
import { EffectsView } from "./effects";
import { FiltersView } from "./filters";
import { AdjustmentView } from "./adjustment";

export function VisualsCombinedView() {
	return (
		<SubTabView
			tabs={[
				{ key: "effects", label: "Effects", content: <EffectsView /> },
				{ key: "filters", label: "Filters", content: <FiltersView /> },
				{ key: "adjustment", label: "Adjust", content: <AdjustmentView /> },
			]}
		/>
	);
}
