import type { ImageElement, VideoElement } from "@/types/timeline";

export function VideoProperties({
	_element,
}: {
	_element: VideoElement | ImageElement;
}) {
	return <div className="space-y-4 p-5">Video properties</div>;
}
