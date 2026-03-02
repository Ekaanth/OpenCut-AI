import {
	useState,
	useCallback,
	useEffect,
	useRef,
	type MouseEvent as ReactMouseEvent,
} from "react";
import { useEditor } from "@/hooks/use-editor";
import { useKeyframeSelection } from "./use-keyframe-selection";
import { snapTimeToFrame } from "@/lib/time";
import { timelineTimeToSnappedPixels } from "@/lib/timeline";
import {
	DRAG_THRESHOLD_PX,
	TIMELINE_CONSTANTS,
} from "@/constants/timeline-constants";
import { RetimeKeyframeCommand } from "@/lib/commands/timeline/element/keyframes/retime-keyframe";
import { BatchCommand } from "@/lib/commands";
import type { SelectedKeyframeRef } from "@/types/animation";
import type { TimelineElement } from "@/types/timeline";
import type { Command } from "@/lib/commands/base-command";

export interface KeyframeDragState {
	isDragging: boolean;
	draggingKeyframeIds: Set<string>;
	deltaTime: number;
}

const initialDragState: KeyframeDragState = {
	isDragging: false,
	draggingKeyframeIds: new Set(),
	deltaTime: 0,
};

interface PendingKeyframeDrag {
	keyframeRefs: SelectedKeyframeRef[];
	startMouseX: number;
}

export function useKeyframeDrag({
	zoomLevel,
	element,
}: {
	zoomLevel: number;
	element: TimelineElement;
}) {
	const editor = useEditor();
	const {
		selectedKeyframes,
		isKeyframeSelected,
		setKeyframeSelection,
		toggleKeyframeSelection,
		selectKeyframeRange,
	} = useKeyframeSelection();

	const [dragState, setDragState] =
		useState<KeyframeDragState>(initialDragState);
	const [isPendingDrag, setIsPendingDrag] = useState(false);

	const pendingDragRef = useRef<PendingKeyframeDrag | null>(null);
	const mouseDownXRef = useRef<number | null>(null);

	const activeProject = editor.project.getActive();
	const fps = activeProject.settings.fps;

	const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;

	const endDrag = useCallback(() => {
		setDragState(initialDragState);
	}, []);

	const commitDrag = useCallback(
		({
			keyframeRefs,
			deltaTime,
		}: {
			keyframeRefs: SelectedKeyframeRef[];
			deltaTime: number;
		}) => {
			const commands: Command[] = keyframeRefs.flatMap((keyframeRef) => {
				const channel = element.animations?.channels[keyframeRef.propertyPath];
				const keyframe = channel?.keyframes.find(
					(keyframe) => keyframe.id === keyframeRef.keyframeId,
				);
				if (!keyframe) return [];
				const nextTime = Math.max(
					0,
					Math.min(element.duration, keyframe.time + deltaTime),
				);
				return [
					new RetimeKeyframeCommand({
						trackId: keyframeRef.trackId,
						elementId: keyframeRef.elementId,
						propertyPath: keyframeRef.propertyPath,
						keyframeId: keyframeRef.keyframeId,
						nextTime,
					}),
				];
			});

			if (commands.length === 1) {
				editor.command.execute({ command: commands[0] });
			} else if (commands.length > 1) {
				editor.command.execute({ command: new BatchCommand(commands) });
			}
		},
		[editor.command, element],
	);

	useEffect(() => {
		if (!dragState.isDragging && !isPendingDrag) return;

		const handleMouseMove = ({ clientX }: MouseEvent) => {
			if (isPendingDrag && pendingDragRef.current) {
				const deltaX = Math.abs(clientX - pendingDragRef.current.startMouseX);
				if (deltaX <= DRAG_THRESHOLD_PX) return;

				const pending = pendingDragRef.current;
				pendingDragRef.current = null;
				setIsPendingDrag(false);
				setDragState({
					isDragging: true,
					draggingKeyframeIds: new Set(
						pending.keyframeRefs.map((keyframe) => keyframe.keyframeId),
					),
					deltaTime: 0,
				});
				return;
			}

			if (!dragState.isDragging) return;

			const startX = mouseDownXRef.current ?? clientX;
			const rawDelta = (clientX - startX) / pixelsPerSecond;
			const snappedDelta = snapTimeToFrame({ time: rawDelta, fps });

			setDragState((previous) => ({ ...previous, deltaTime: snappedDelta }));
		};

		document.addEventListener("mousemove", handleMouseMove);
		return () => document.removeEventListener("mousemove", handleMouseMove);
	}, [dragState.isDragging, isPendingDrag, pixelsPerSecond, fps]);

	useEffect(() => {
		if (!dragState.isDragging) return;

		const handleMouseUp = () => {
			const draggingRefs = selectedKeyframes.filter(
				(keyframe) =>
					keyframe.elementId === element.id &&
					dragState.draggingKeyframeIds.has(keyframe.keyframeId),
			);

			if (draggingRefs.length > 0 && dragState.deltaTime !== 0) {
				commitDrag({
					keyframeRefs: draggingRefs,
					deltaTime: dragState.deltaTime,
				});
			}

			endDrag();
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [
		dragState.isDragging,
		dragState.draggingKeyframeIds,
		dragState.deltaTime,
		selectedKeyframes,
		element.id,
		commitDrag,
		endDrag,
	]);

	useEffect(() => {
		if (!isPendingDrag) return;

		const handleMouseUp = () => {
			pendingDragRef.current = null;
			setIsPendingDrag(false);
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [isPendingDrag]);

	const handleKeyframeMouseDown = useCallback(
		({
			event,
			keyframes,
		}: {
			event: ReactMouseEvent;
			keyframes: SelectedKeyframeRef[];
		}) => {
			event.preventDefault();
			event.stopPropagation();

		mouseDownXRef.current = event.clientX;

		const anySelected = keyframes.some((keyframe) =>
			isKeyframeSelected({ keyframe }),
		);

		if (!anySelected) {
			setKeyframeSelection({ keyframes });
		}

		const keyframeRefsToTrack = anySelected ? selectedKeyframes : keyframes;

		pendingDragRef.current = {
			keyframeRefs: keyframeRefsToTrack,
			startMouseX: event.clientX,
		};
		setIsPendingDrag(true);
	},
	[isKeyframeSelected, selectedKeyframes, setKeyframeSelection],
);

	const handleKeyframeClick = useCallback(
		({
			event,
			keyframes,
			orderedKeyframes,
		}: {
			event: ReactMouseEvent;
			keyframes: SelectedKeyframeRef[];
			orderedKeyframes: SelectedKeyframeRef[];
		}) => {
			event.stopPropagation();

			const wasDrag =
				mouseDownXRef.current !== null &&
				Math.abs(event.clientX - mouseDownXRef.current) > DRAG_THRESHOLD_PX;
			mouseDownXRef.current = null;

			if (wasDrag) return;

			if (event.shiftKey) {
				selectKeyframeRange({
					orderedKeyframes,
					targetKeyframes: keyframes,
					isAdditive: event.metaKey || event.ctrlKey,
				});
				return;
			}

			toggleKeyframeSelection({
				keyframes,
				isMultiKey: event.metaKey || event.ctrlKey,
			});
		},
		[toggleKeyframeSelection, selectKeyframeRange],
	);

	const getVisualOffsetPx = useCallback(
		({
			indicatorTime,
			indicatorOffsetPx,
			isBeingDragged,
			displayedStartTime,
			elementLeft,
		}: {
			indicatorTime: number;
			indicatorOffsetPx: number;
			isBeingDragged: boolean;
			displayedStartTime: number;
			elementLeft: number;
		}): number => {
			if (!isBeingDragged) return indicatorOffsetPx;
			const clampedTime = Math.max(
				0,
				Math.min(element.duration, indicatorTime + dragState.deltaTime),
			);
			return (
				timelineTimeToSnappedPixels({
					time: displayedStartTime + clampedTime,
					zoomLevel,
				}) - elementLeft
			);
		},
		[dragState.deltaTime, element.duration, zoomLevel],
	);

	return {
		keyframeDragState: dragState,
		handleKeyframeMouseDown,
		handleKeyframeClick,
		getVisualOffsetPx,
	};
}
