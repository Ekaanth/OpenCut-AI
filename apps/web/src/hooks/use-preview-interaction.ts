import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useSyncExternalStore } from "react";
import type { Transform, TimelineTrack } from "@/types/timeline";

interface DragState {
	startX: number;
	startY: number;
	tracksSnapshot: TimelineTrack[];
	elements: Array<{
		trackId: string;
		elementId: string;
		initialTransform: Transform;
	}>;
}

export function usePreviewInteraction({
	canvasRef,
}: {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
	const editor = useEditor();
	const [isDragging, setIsDragging] = useState(false);
	const dragStateRef = useRef<DragState | null>(null);

	const selectedElements = useSyncExternalStore(
		(listener) => editor.selection.subscribe(listener),
		() => editor.selection.getSelectedElements(),
	);

	const getCanvasCoordinates = useCallback(
		({ clientX, clientY }: { clientX: number; clientY: number }) => {
			if (!canvasRef.current) return { x: 0, y: 0 };

			const rect = canvasRef.current.getBoundingClientRect();
			const logicalWidth = canvasRef.current.width;
			const logicalHeight = canvasRef.current.height;
			const scaleX = logicalWidth / rect.width;
			const scaleY = logicalHeight / rect.height;

			const canvasX = (clientX - rect.left) * scaleX;
			const canvasY = (clientY - rect.top) * scaleY;

			return { x: canvasX, y: canvasY };
		},
		[canvasRef],
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent) => {
			if (selectedElements.length === 0) return;

			const elementsWithTracks = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});

			const draggableElements = elementsWithTracks.filter(
				({ element }) =>
					element.type === "video" ||
					element.type === "image" ||
					element.type === "text" ||
					element.type === "sticker",
			);

			if (draggableElements.length === 0) return;

			const startPos = getCanvasCoordinates({
				clientX: event.clientX,
				clientY: event.clientY,
			});

			dragStateRef.current = {
				startX: startPos.x,
				startY: startPos.y,
				tracksSnapshot: editor.timeline.getTracks(),
				elements: draggableElements.map(({ track, element }) => ({
					trackId: track.id,
					elementId: element.id,
					initialTransform: (element as { transform: Transform }).transform,
				})),
			};

			setIsDragging(true);
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[selectedElements, editor, getCanvasCoordinates],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent) => {
			if (!dragStateRef.current || !isDragging) return;

			const currentPos = getCanvasCoordinates({
				clientX: event.clientX,
				clientY: event.clientY,
			});

			const deltaX = currentPos.x - dragStateRef.current.startX;
			const deltaY = currentPos.y - dragStateRef.current.startY;

			for (const { trackId, elementId, initialTransform } of dragStateRef
				.current.elements) {
				const newPosition = {
					x: initialTransform.position.x + deltaX,
					y: initialTransform.position.y + deltaY,
				};

				editor.timeline.updateElements({
					updates: [
						{
							trackId,
							elementId,
							updates: {
								transform: {
									...initialTransform,
									position: newPosition,
								},
							},
						},
					],
					pushHistory: false,
				});
			}
		},
		[isDragging, getCanvasCoordinates, editor],
	);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent) => {
			if (!dragStateRef.current || !isDragging) return;

			const currentPos = getCanvasCoordinates({
				clientX: event.clientX,
				clientY: event.clientY,
			});

			const deltaX = currentPos.x - dragStateRef.current.startX;
			const deltaY = currentPos.y - dragStateRef.current.startY;

			// revert to pre-drag state so the command captures the correct undo snapshot
			editor.timeline.updateTracks(dragStateRef.current.tracksSnapshot);

			const updates = dragStateRef.current.elements.map(
				({ trackId, elementId, initialTransform }) => {
					const newPosition = {
						x: initialTransform.position.x + deltaX,
						y: initialTransform.position.y + deltaY,
					};

					return {
						trackId,
						elementId,
						updates: {
							transform: {
								...initialTransform,
								position: newPosition,
							},
						},
					};
				},
			);

			editor.timeline.updateElements({ updates });

			dragStateRef.current = null;
			setIsDragging(false);
			event.currentTarget.releasePointerCapture(event.pointerId);
		},
		[isDragging, getCanvasCoordinates, editor],
	);

	return {
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp,
	};
}
