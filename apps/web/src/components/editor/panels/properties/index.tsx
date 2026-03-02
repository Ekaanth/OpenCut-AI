"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioProperties } from "./audio-properties";
import { VideoProperties } from "./video-properties";
import { TextProperties } from "./text-properties";
import { EffectProperties } from "./effect-properties";
import { ClipEffectsProperties } from "./clip-effects-properties";
import { EmptyView } from "./empty-view";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { usePropertiesStore } from "@/stores/properties-store";
import { isVisualElement } from "@/lib/timeline";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";

function ElementProperties({
	track,
	element,
}: {
	track: TimelineTrack;
	element: TimelineElement;
}) {
	if (element.type === "text") {
		return <TextProperties element={element} trackId={track.id} />;
	}
	if (element.type === "audio") {
		return <AudioProperties />;
	}
	if (
		element.type === "video" ||
		element.type === "image" ||
		element.type === "sticker"
	) {
		return <VideoProperties element={element} trackId={track.id} />;
	}
	if (element.type === "effect") {
		return <EffectProperties element={element} trackId={track.id} />;
	}
	return null;
}

export function PropertiesPanel() {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const clipEffectsTarget = usePropertiesStore(
		(state) => state.clipEffectsTarget,
	);

	const clipEffectsTrack = clipEffectsTarget
		? editor.timeline.getTrackById({ trackId: clipEffectsTarget.trackId })
		: null;
	const clipEffectsElement = clipEffectsTrack?.elements.find(
		(element) => element.id === clipEffectsTarget?.elementId,
	);
	const isShowingClipEffects =
		clipEffectsTrack &&
		clipEffectsElement &&
		isVisualElement(clipEffectsElement);

	const elementsWithTracks = editor.timeline.getElementsWithTracks({
		elements: selectedElements,
	});

	return (
		<div className="panel bg-background h-full rounded-sm border overflow-hidden">
			{isShowingClipEffects ? (
				<ClipEffectsProperties
					element={clipEffectsElement}
					trackId={clipEffectsTrack.id}
				/>
			) : selectedElements.length > 0 ? (
				<ScrollArea className="h-full scrollbar-hidden">
					{elementsWithTracks.map(({ track, element }) => (
						<ElementProperties
							key={element.id}
							track={track}
							element={element}
						/>
					))}
				</ScrollArea>
			) : (
				<EmptyView />
			)}
		</div>
	);
}
