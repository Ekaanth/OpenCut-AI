import { usePreviewInteraction } from "@/hooks/use-preview-interaction";
import { cn } from "@/utils/ui";

export function PreviewInteractionOverlay({
	canvasRef,
}: {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
	const { onPointerDown, onPointerMove, onPointerUp } =
		usePreviewInteraction({ canvasRef });

	return (
		<div
			className={cn("absolute inset-0 pointer-events-auto")}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		/>
	);
}
