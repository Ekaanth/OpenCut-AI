"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioProperties } from "./audio-properties";
import { VideoProperties } from "./video-properties";
import { TextProperties } from "./text-properties";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings05Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";

export function PropertiesPanel() {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();

	const elementsWithTracks = editor.timeline.getElementsWithTracks({
		elements: selectedElements,
	});

	return (
		<>
			{selectedElements.length > 0 ? (
				<ScrollArea className="bg-panel h-full rounded-sm">
					{elementsWithTracks.map(({ track, element }) => {
						if (element.type === "text") {
							return (
								<div key={element.id}>
									<TextProperties element={element} trackId={track.id} />
								</div>
							);
						}
						if (element.type === "audio") {
							return <AudioProperties key={element.id} _element={element} />;
						}
						if (element.type === "video" || element.type === "image") {
							return (
								<div key={element.id}>
									<VideoProperties _element={element} />
								</div>
							);
						}
						return null;
					})}
				</ScrollArea>
			) : (
				<EmptyView />
			)}
		</>
	);
}

function EmptyView() {
	return (
		<div className="bg-panel flex h-full flex-col items-center justify-center gap-3 p-4">
			<HugeiconsIcon
				icon={Settings05Icon}
				className="text-muted-foreground/75 size-10"
				strokeWidth={1}
			/>
			<div className="flex flex-col gap-2 text-center">
				<p className="text-lg font-medium">It's empty here</p>
				<p className="text-muted-foreground text-sm text-balance">
					Click an element on the timeline to edit its properties
				</p>
			</div>
		</div>
	);
}
