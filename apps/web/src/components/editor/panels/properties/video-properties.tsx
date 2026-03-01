import type { ImageElement, StickerElement, VideoElement } from "@/types/timeline";
import { BlendingSection, TransformSection } from "./sections";

export function VideoProperties({
	element,
	trackId,
}: {
	element: VideoElement | ImageElement | StickerElement;
	trackId: string;
}) {
	return (
		<div className="flex h-full flex-col">
			<TransformSection element={element} trackId={trackId} />
			<BlendingSection element={element} trackId={trackId} />
		</div>
	);
}
