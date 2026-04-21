"use client";

import { useCallback } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	getAllTransitions,
	type TransitionDefinition,
} from "@/lib/transitions";
import { useEditor } from "@/hooks/use-editor";
import { AddTransitionCommand } from "@/lib/commands/timeline/element/transitions/add-transition";
import { isVisualElement } from "@/lib/timeline";
import { cn } from "@/utils/ui";

const CATEGORY_ICONS: Record<string, string> = {
	dissolve: "◐",
	slide: "▶",
	wipe: "▮",
	zoom: "⊕",
	dip: "◻",
};

const CATEGORY_LABELS: Record<string, string> = {
	dissolve: "Dissolve",
	slide: "Slide",
	wipe: "Wipe",
	zoom: "Zoom",
	dip: "Dip",
};

export function TransitionsView() {
	const transitions = getAllTransitions();

	const categories = Array.from(new Set(transitions.map((t) => t.category)));

	return (
		<PanelView title="Transitions">
			<p className="text-[11px] text-muted-foreground px-1 pb-2">
				Select a clip on the timeline, then click a transition to apply it to
				the outgoing edge.
			</p>
			{categories.map((category) => (
				<div key={category} className="mb-3">
					<h3 className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">
						{CATEGORY_LABELS[category] ?? category}
					</h3>
					<div
						className="grid gap-2"
						style={{
							gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
						}}
					>
						{transitions
							.filter((t) => t.category === category)
							.map((transition) => (
								<TransitionItem key={transition.type} transition={transition} />
							))}
					</div>
				</div>
			))}
		</PanelView>
	);
}

function TransitionItem({ transition }: { transition: TransitionDefinition }) {
	const editor = useEditor();

	const handleApply = useCallback(() => {
		const selected = editor.selection.getSelectedElements();
		if (selected.length === 0) return;

		const { elementId, trackId } = selected[0];
		const tracks = editor.timeline.getTracks();
		const track = tracks.find((t) => t.id === trackId);
		if (!track) return;
		const element = track.elements.find((e) => e.id === elementId);
		if (!element || !isVisualElement(element)) return;

		editor.command.execute({
			command: new AddTransitionCommand({
				trackId,
				elementId,
				transitionType: transition.type,
			}),
		});
	}, [editor, transition.type]);

	return (
		<button
			type="button"
			onClick={handleApply}
			className={cn(
				"flex flex-col items-center gap-1.5 rounded-md border p-2",
				"hover:bg-accent/50 transition-colors cursor-pointer",
				"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
			)}
		>
			<div className="size-12 rounded bg-muted/50 flex items-center justify-center text-lg">
				{CATEGORY_ICONS[transition.category] ?? "◇"}
			</div>
			<span className="text-[11px] text-center leading-tight truncate w-full">
				{transition.name}
			</span>
		</button>
	);
}
