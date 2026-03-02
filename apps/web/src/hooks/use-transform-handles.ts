import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useShiftKey } from "@/hooks/use-shift-key";
import {
	getVisibleElementsWithBounds,
	type ElementWithBounds,
} from "@/lib/preview/element-bounds";
import {
	screenPixelsToLogicalThreshold,
	screenToCanvas,
} from "@/lib/preview/preview-coords";
import {
	MIN_SCALE,
	SNAP_THRESHOLD_SCREEN_PIXELS,
	snapRotation,
	snapScale,
	type SnapLine,
} from "@/lib/preview/preview-snap";
import { isVisualElement } from "@/lib/timeline/element-utils";
import {
	getElementLocalTime,
	resolveTransformAtTime,
	setChannel,
} from "@/lib/animation";
import type { Transform } from "@/types/timeline";
import type { ElementAnimations } from "@/types/animation";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type HandleType = Corner | "rotation";

interface ScaleState {
	trackId: string;
	elementId: string;
	initialTransform: Transform;
	initialDistance: number;
	initialBoundsCx: number;
	initialBoundsCy: number;
	baseWidth: number;
	baseHeight: number;
	shouldClearScaleAnimation: boolean;
	animationsWithoutScale: ElementAnimations | undefined;
}

interface RotationState {
	trackId: string;
	elementId: string;
	initialTransform: Transform;
	initialAngle: number;
	initialBoundsCx: number;
	initialBoundsCy: number;
}

function areSnapLinesEqual({
	previousLines,
	nextLines,
}: {
	previousLines: SnapLine[];
	nextLines: SnapLine[];
}): boolean {
	if (previousLines.length !== nextLines.length) {
		return false;
	}
	for (const [index, line] of previousLines.entries()) {
		const nextLine = nextLines[index];
		if (!nextLine) {
			return false;
		}
		if (line.type !== nextLine.type || line.position !== nextLine.position) {
			return false;
		}
	}
	return true;
}

function getCornerDistance({
	bounds,
	corner,
}: {
	bounds: {
		cx: number;
		cy: number;
		width: number;
		height: number;
		rotation: number;
	};
	corner: Corner;
}): number {
	const halfWidth = bounds.width / 2;
	const halfHeight = bounds.height / 2;
	const angleRad = (bounds.rotation * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);

	const localX =
		corner === "top-left" || corner === "bottom-left" ? -halfWidth : halfWidth;
	const localY =
		corner === "top-left" || corner === "top-right" ? -halfHeight : halfHeight;

	const rotatedX = localX * cos - localY * sin;
	const rotatedY = localX * sin + localY * cos;
	return Math.sqrt(rotatedX * rotatedX + rotatedY * rotatedY) || 1;
}

export function useTransformHandles({
	canvasRef,
}: {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
	const editor = useEditor();
	const isShiftHeldRef = useShiftKey();
	const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
	const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
	const snapLinesRef = useRef<SnapLine[]>([]);
	const scaleStateRef = useRef<ScaleState | null>(null);
	const rotationStateRef = useRef<RotationState | null>(null);

	const selectedElements = useSyncExternalStore(
		(listener) => editor.selection.subscribe(listener),
		() => editor.selection.getSelectedElements(),
	);

	const tracks = editor.timeline.getTracks();
	const currentTime = editor.playback.getCurrentTime();
	const currentTimeRef = useRef(currentTime);
	currentTimeRef.current = currentTime;
	const mediaAssets = editor.media.getAssets();
	const canvasSize = editor.project.getActive().settings.canvasSize;

	const elementsWithBounds = getVisibleElementsWithBounds({
		tracks,
		currentTime,
		canvasSize,
		mediaAssets,
	});

	const selectedWithBounds: ElementWithBounds | null =
		selectedElements.length === 1
			? (elementsWithBounds.find(
					(entry) =>
						entry.trackId === selectedElements[0].trackId &&
						entry.elementId === selectedElements[0].elementId,
				) ?? null)
			: null;

	const hasVisualSelection =
		selectedWithBounds !== null && isVisualElement(selectedWithBounds.element);

	const handleCornerPointerDown = useCallback(
		({ event, corner }: { event: React.PointerEvent; corner: Corner }) => {
			if (!selectedWithBounds) return;
			event.stopPropagation();

			const { bounds, trackId, elementId, element } = selectedWithBounds;
			if (!isVisualElement(element)) return;

			const localTime = getElementLocalTime({
				timelineTime: currentTimeRef.current,
				elementStartTime: element.startTime,
				elementDuration: element.duration,
			});
			const resolvedTransform = resolveTransformAtTime({
				baseTransform: element.transform,
				animations: element.animations,
				localTime,
			});

			const initialDistance = getCornerDistance({ bounds, corner });
			const baseWidth = bounds.width / resolvedTransform.scale;
			const baseHeight = bounds.height / resolvedTransform.scale;
			const shouldClearScaleAnimation =
				!!element.animations?.channels["transform.scale"];
			const animationsWithoutScale = shouldClearScaleAnimation
				? setChannel({
						animations: element.animations,
						propertyPath: "transform.scale",
						channel: undefined,
					})
				: element.animations;

			scaleStateRef.current = {
				trackId,
				elementId,
				initialTransform: resolvedTransform,
				initialDistance,
				initialBoundsCx: bounds.cx,
				initialBoundsCy: bounds.cy,
				baseWidth,
				baseHeight,
				shouldClearScaleAnimation,
				animationsWithoutScale,
			};
			setActiveHandle(corner);
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		},
		[selectedWithBounds],
	);

	const handleRotationPointerDown = useCallback(
		({ event }: { event: React.PointerEvent }) => {
			if (!selectedWithBounds || !canvasRef.current) return;
			event.stopPropagation();

			const { bounds, trackId, elementId, element } = selectedWithBounds;
			if (!isVisualElement(element)) return;

			const localTime = getElementLocalTime({
				timelineTime: currentTimeRef.current,
				elementStartTime: element.startTime,
				elementDuration: element.duration,
			});
			const resolvedTransform = resolveTransformAtTime({
				baseTransform: element.transform,
				animations: element.animations,
				localTime,
			});

			const position = screenToCanvas({
				clientX: event.clientX,
				clientY: event.clientY,
				canvas: canvasRef.current,
			});
		const deltaX = position.x - bounds.cx;
		const deltaY = position.y - bounds.cy;
		const initialAngle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

			rotationStateRef.current = {
				trackId,
				elementId,
				initialTransform: resolvedTransform,
				initialAngle,
				initialBoundsCx: bounds.cx,
				initialBoundsCy: bounds.cy,
			};
			setActiveHandle("rotation");
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		},
		[selectedWithBounds, canvasRef],
	);

	const handlePointerMove = useCallback(
		({ event }: { event: React.PointerEvent }) => {
			if (!canvasRef.current) return;
			if (!scaleStateRef.current && !rotationStateRef.current) return;

			const position = screenToCanvas({
				clientX: event.clientX,
				clientY: event.clientY,
				canvas: canvasRef.current,
			});

			if (
				scaleStateRef.current &&
				activeHandle &&
				activeHandle !== "rotation"
			) {
				const {
					trackId,
					elementId,
					initialTransform,
					initialDistance,
					initialBoundsCx,
					initialBoundsCy,
					baseWidth,
					baseHeight,
					shouldClearScaleAnimation,
					animationsWithoutScale,
				} = scaleStateRef.current;

			const deltaX = position.x - initialBoundsCx;
			const deltaY = position.y - initialBoundsCy;
			const currentDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
				const scaleFactor = currentDistance / initialDistance;
				const proposedScale = Math.max(
					MIN_SCALE,
					initialTransform.scale * scaleFactor,
				);

				const canvasSize = editor.project.getActive().settings.canvasSize;
				const snapThreshold = screenPixelsToLogicalThreshold({
					canvas: canvasRef.current,
					screenPixels: SNAP_THRESHOLD_SCREEN_PIXELS,
				});
				const shouldSnap = !isShiftHeldRef.current;
				const { snappedScale, activeLines } = shouldSnap
					? snapScale({
							proposedScale,
							position: initialTransform.position,
							baseWidth,
							baseHeight,
							canvasSize,
							snapThreshold,
						})
					: { snappedScale: proposedScale, activeLines: [] as SnapLine[] };

				const isSameLines = areSnapLinesEqual({
					previousLines: snapLinesRef.current,
					nextLines: activeLines,
				});

				if (!isSameLines) {
					snapLinesRef.current = activeLines;
					setSnapLines(activeLines);
				}

				const updates: {
					transform: Transform;
					animations?: ElementAnimations;
				} = {
					transform: { ...initialTransform, scale: snappedScale },
				};
				if (shouldClearScaleAnimation) {
					updates.animations = animationsWithoutScale;
				}

				editor.timeline.previewElements({
					updates: [
						{
							trackId,
							elementId,
							updates,
						},
					],
				});
				return;
			}

			if (rotationStateRef.current && activeHandle === "rotation") {
				const {
					trackId,
					elementId,
					initialTransform,
					initialAngle,
					initialBoundsCx,
					initialBoundsCy,
				} = rotationStateRef.current;

			const deltaX = position.x - initialBoundsCx;
			const deltaY = position.y - initialBoundsCy;
			const currentAngle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
				let deltaAngle = currentAngle - initialAngle;
				if (deltaAngle > 180) deltaAngle -= 360;
				if (deltaAngle < -180) deltaAngle += 360;
				const newRotate = initialTransform.rotate + deltaAngle;
				const shouldSnapRotation = !isShiftHeldRef.current;
				const { snappedRotation } = shouldSnapRotation
					? snapRotation({ proposedRotation: newRotate })
					: { snappedRotation: newRotate };

				editor.timeline.previewElements({
					updates: [
						{
							trackId,
							elementId,
							updates: {
								transform: { ...initialTransform, rotate: snappedRotation },
							},
						},
					],
				});
			}
		},
		[activeHandle, canvasRef, editor, isShiftHeldRef],
	);

	const handlePointerUp = useCallback(
		({ event }: { event: React.PointerEvent }) => {
			if (scaleStateRef.current || rotationStateRef.current) {
				editor.timeline.commitPreview();
				scaleStateRef.current = null;
				rotationStateRef.current = null;
				setActiveHandle(null);
				snapLinesRef.current = [];
				setSnapLines([]);
			}
			(event.currentTarget as HTMLElement).releasePointerCapture(
				event.pointerId,
			);
		},
		[editor],
	);

	return {
		selectedWithBounds,
		hasVisualSelection,
		activeHandle,
		snapLines,
		handleCornerPointerDown,
		handleRotationPointerDown,
		handlePointerMove,
		handlePointerUp,
	};
}
