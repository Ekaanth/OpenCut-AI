"use client";

import { SubTabView } from "./sub-tab-view";
import { EffectsView } from "./effects";
import { FiltersView } from "./filters";
import { AdjustmentView } from "./adjustment";
import { TransitionsView } from "./transitions";

export function VisualsCombinedView() {
	return (
		<SubTabView
			tabs={[
				{
					key: "transitions",
					label: "Transitions",
					content: <TransitionsView />,
				},
				{ key: "effects", label: "Effects", content: <EffectsView /> },
				{ key: "filters", label: "Filters", content: <FiltersView /> },
				{ key: "adjustment", label: "Adjust", content: <AdjustmentView /> },
			]}
		/>
	);
}
