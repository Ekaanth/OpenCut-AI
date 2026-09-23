import {
	useState,
	useCallback,
	useEffect,
	useRef,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
} from "react";
import { useEditor } from "@/hooks/use-editor";
import { useShiftKey } from "@/hooks/use-shift-key";
import { useTimelineStore } from "@/stores/timeline-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	DRAG_THRESHOLD_PX,
	TIMELINE_CONSTANTS,
} from "@/constants/timeline-constants";
import { snapTimeToFrame } from "@/lib/time";
import { computeDropTarget } from "@/lib/timeline/drop-utils";
import { getMouseTimeFromClientX } from "@/lib/timeline/drag-utils";
import { wouldElementOverlap } from "@/lib/timeline/element-utils";
import { generateUUID } from "@/utils/id";
import { toast } from "sonner";
import {
	snapElementEdge,
	type SnapPoint,
} from "@/lib/timeline/snap-utils";
import type {
	DropTarget,
	ElementDragState,
	TimelineElement,
	TimelineTrack,
} from "@/types/timeline";

interface UseElementInteractionProps {
	zoomLevel: number;
	timelineRef: RefObject<HTMLDivElement | null>;
	tracksContainerRef: RefObject<HTMLDivElement | null>;
	tracksScrollRef: RefObject<HTMLDivElement | null>;
	headerRef?: RefObject<HTMLElement | null>;
	snappingEnabled: boolean;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
}

const MOUSE_BUTTON_RIGHT = 2;

const initialDragState: ElementDragState = {
	isDragging: false,
	elementId: null,
	trackId: null,
	startMouseX: 0,
	startMouseY: 0,
	startElementTime: 0,
	clickOffsetTime: 0,
	currentTime: 0,
	currentMouseY: 0,
};

interface PendingDragState {
	elementId: string;
	trackId: string;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
}

function getClickOffsetTime({
	clientX,
	elementRect,
	zoomLevel,
}: {
	clientX: number;
	elementRect: DOMRect;
	zoomLevel: number;
}): number {
	const clickOffsetX = clientX - elementRect.left;
	return clickOffsetX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
}

function getVerticalDragDirection({
	startMouseY,
	currentMouseY,
}: {
	startMouseY: number;
	currentMouseY: number;
}): "up" | "down" | null {
	if (currentMouseY < startMouseY) return "up";
	if (currentMouseY > startMouseY) return "down";
	return null;
}

function getDragDropTarget({
	clientX,
	clientY,
	elementId,
	trackId,
	tracks,
	tracksContainerRef,
	tracksScrollRef,
	headerRef,
	zoomLevel,
	snappedTime,
	verticalDragDirection,
}: {
	clientX: number;
	clientY: number;
	elementId: string;
	trackId: string;
	tracks: TimelineTrack[];
	tracksContainerRef: RefObject<HTMLDivElement | null>;
	tracksScrollRef: RefObject<HTMLDivElement | null>;
	headerRef?: RefObject<HTMLElement | null>;
	zoomLevel: number;
	snappedTime: number;
	verticalDragDirection?: "up" | "down" | null;
}): DropTarget | null {
	const containerRect = tracksContainerRef.current?.getBoundingClientRect();
	const scrollContainer = tracksScrollRef.current;
	if (!containerRect || !scrollContainer) return null;

	const sourceTrack = tracks.find(({ id }) => id === trackId);
	const movingElement = sourceTrack?.elements.find(
		({ id }) => id === elementId,
	);
	if (!movingElement) return null;

	const elementDuration = movingElement.duration;
	const scrollLeft = scrollContainer.scrollLeft;
	const scrollTop = scrollContainer.scrollTop;
	const scrollContainerRect = scrollContainer.getBoundingClientRect();
	const headerHeight = headerRef?.current?.getBoundingClientRect().height ?? 0;
	const mouseX = clientX - scrollContainerRect.left + scrollLeft;
	const mouseY = clientY - scrollContainerRect.top + scrollTop - headerHeight;

	return computeDropTarget({
		elementType: movingElement.type,
		mouseX,
		mouseY,
		tracks,
		playheadTime: snappedTime,
		isExternalDrop: false,
		elementDuration,
		pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
		zoomLevel,
		startTimeOverride: snappedTime,
		excludeElementId: movingElement.id,
		verticalDragDirection,
	});
}

interface StartDragParams
	extends Omit<
		ElementDragState,
		"isDragging" | "currentTime" | "currentMouseY"
	> {
	initialCurrentTime: number;
	initialCurrentMouseY: number;
}

export function useElementInteraction({
	zoomLevel,
	timelineRef,
	tracksContainerRef,
	tracksScrollRef,
	headerRef,
	snappingEnabled,
	onSnapPointChange,
}: UseElementInteractionProps) {
	const editor = useEditor();
	const rippleEditingEnabled = useTimelineStore((s) => s.rippleEditingEnabled);
	const isShiftHeldRef = useShiftKey();
	const tracks = editor.timeline.getTracks();
	const {
		selectedElements,
		isElementSelected,
		selectElement,
		handleElementClick: handleSelectionClick,
	} = useElementSelection();

	const [dragState, setDragState] =
		useState<ElementDragState>(initialDragState);
	const [dragDropTarget, setDragDropTarget] = useState<DropTarget | null>(null);
	const [isPendingDrag, setIsPendingDrag] = useState(false);
	const pendingDragRef = useRef<PendingDragState | null>(null);
	const lastMouseXRef = useRef(0);
	const mouseDownLocationRef = useRef<{ x: number; y: number } | null>(null);
	// Snapshot of every selected element's original {trackId, elementId,
	// startTime} at drag start, set only when dragging a member of a
	// multi-selection. Each element keeps its own track; only startTime shifts.
	const groupDragRef = useRef<
		{ trackId: string; elementId: string; startTime: number }[] | null
	>(null);

	const startDrag = useCallback(
		({
			elementId,
			trackId,
			startMouseX,
			startMouseY,
			startElementTime,
			clickOffsetTime,
			initialCurrentTime,
			initialCurrentMouseY,
		}: StartDragParams) => {
			setDragState({
				isDragging: true,
				elementId,
				trackId,
				startMouseX,
				startMouseY,
				startElementTime,
				clickOffsetTime,
				currentTime: initialCurrentTime,
				currentMouseY: initialCurrentMouseY,
			});
		},
		[],
	);

	const endDrag = useCallback(() => {
		setDragState(initialDragState);
		setDragDropTarget(null);
		groupDragRef.current = null;
	}, []);

	const getDragSnapResult = useCallback(
		({
			frameSnappedTime,
			movingElement,
		}: {
			frameSnappedTime: number;
			movingElement: TimelineElement | null | undefined;
		}) => {
			const shouldSnap = snappingEnabled && !isShiftHeldRef.current;
			if (!shouldSnap || !movingElement) {
				return { snappedTime: frameSnappedTime, snapPoint: null };
			}

			const elementDuration = movingElement.duration;
			const playheadTime = editor.playback.getCurrentTime();

			const startSnap = snapElementEdge({
				targetTime: frameSnappedTime,
				elementDuration,
				tracks,
				playheadTime,
				zoomLevel,
				excludeElementId: movingElement.id,
				snapToStart: true,
			});

			const endSnap = snapElementEdge({
				targetTime: frameSnappedTime,
				elementDuration,
				tracks,
				playheadTime,
				zoomLevel,
				excludeElementId: movingElement.id,
				snapToStart: false,
			});

			const snapResult =
				startSnap.snapDistance <= endSnap.snapDistance ? startSnap : endSnap;
			if (!snapResult.snapPoint) {
				return { snappedTime: frameSnappedTime, snapPoint: null };
			}

			return {
				snappedTime: snapResult.snappedTime,
				snapPoint: snapResult.snapPoint,
			};
		},
		[snappingEnabled, editor.playback, tracks, zoomLevel, isShiftHeldRef],
	);

	useEffect(() => {
		if (!dragState.isDragging && !isPendingDrag) return;

		const handleMouseMove = ({ clientX, clientY }: MouseEvent) => {
			let startedDragThisEvent = false;
			const timeline = timelineRef.current;
			const scrollContainer = tracksScrollRef.current;
			if (!timeline || !scrollContainer) return;
			lastMouseXRef.current = clientX;

			if (isPendingDrag && pendingDragRef.current) {
				const deltaX = Math.abs(clientX - pendingDragRef.current.startMouseX);
				const deltaY = Math.abs(clientY - pendingDragRef.current.startMouseY);
				if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
					const activeProject = editor.project.getActive();
					if (!activeProject) return;
					const scrollLeft = scrollContainer.scrollLeft;
					const mouseTime = getMouseTimeFromClientX({
						clientX,
						containerRect: scrollContainer.getBoundingClientRect(),
						zoomLevel,
						scrollLeft,
					});
					const adjustedTime = Math.max(
						0,
						mouseTime - pendingDragRef.current.clickOffsetTime,
					);
					const snappedTime = snapTimeToFrame({
						time: adjustedTime,
						fps: activeProject.settings.fps,
					});
					startDrag({
						...pendingDragRef.current,
						initialCurrentTime: snappedTime,
						initialCurrentMouseY: clientY,
					});
					startedDragThisEvent = true;
					pendingDragRef.current = null;
					setIsPendingDrag(false);
				} else {
					return;
				}
			}

			if (startedDragThisEvent) {
				return;
			}

			if (dragState.elementId && dragState.trackId) {
				const alreadySelected = isElementSelected({
					trackId: dragState.trackId,
					elementId: dragState.elementId,
				});
				if (!alreadySelected) {
					selectElement({
						trackId: dragState.trackId,
						elementId: dragState.elementId,
					});
				}
			}

			const activeProject = editor.project.getActive();
			if (!activeProject) return;

			const scrollLeft = scrollContainer.scrollLeft;
			const mouseTime = getMouseTimeFromClientX({
				clientX,
				containerRect: scrollContainer.getBoundingClientRect(),
				zoomLevel,
				scrollLeft,
			});
			const adjustedTime = Math.max(0, mouseTime - dragState.clickOffsetTime);
			const fps = activeProject.settings.fps;
			const frameSnappedTime = snapTimeToFrame({ time: adjustedTime, fps });

			const sourceTrack = tracks.find(({ id }) => id === dragState.trackId);
			const movingElement = sourceTrack?.elements.find(
				({ id }) => id === dragState.elementId,
			);
			const { snappedTime, snapPoint } = getDragSnapResult({
				frameSnappedTime,
				movingElement,
			});
			setDragState((previousDragState) => ({
				...previousDragState,
				currentTime: snappedTime,
				currentMouseY: clientY,
			}));
			onSnapPointChange?.(snapPoint);

			if (dragState.elementId && dragState.trackId) {
				const verticalDragDirection = getVerticalDragDirection({
					startMouseY: dragState.startMouseY,
					currentMouseY: clientY,
				});
				const dropTarget = getDragDropTarget({
					clientX,
					clientY,
					elementId: dragState.elementId,
					trackId: dragState.trackId,
					tracks,
					tracksContainerRef,
					tracksScrollRef,
					headerRef,
					zoomLevel,
					snappedTime,
					verticalDragDirection,
				});
				setDragDropTarget(dropTarget?.isNewTrack ? dropTarget : null);
			}
		};

		document.addEventListener("mousemove", handleMouseMove);
		return () => document.removeEventListener("mousemove", handleMouseMove);
	}, [
		dragState.isDragging,
		dragState.clickOffsetTime,
		dragState.elementId,
		dragState.startMouseY,
		dragState.trackId,
		zoomLevel,
		isElementSelected,
		selectElement,
		editor.project,
		timelineRef,
		tracksScrollRef,
		tracksContainerRef,
		headerRef,
		tracks,
		isPendingDrag,
		startDrag,
		getDragSnapResult,
		onSnapPointChange,
	]);

	useEffect(() => {
		if (!dragState.isDragging) return;

		const handleMouseUp = ({ clientX, clientY }: MouseEvent) => {
			if (!dragState.elementId || !dragState.trackId) return;

			if (mouseDownLocationRef.current) {
				const deltaX = Math.abs(clientX - mouseDownLocationRef.current.x);
				const deltaY = Math.abs(clientY - mouseDownLocationRef.current.y);
				if (deltaX <= DRAG_THRESHOLD_PX && deltaY <= DRAG_THRESHOLD_PX) {
					mouseDownLocationRef.current = null;
					endDrag();
					onSnapPointChange?.(null);
					return;
				}
			}

			const dropTarget = getDragDropTarget({
				clientX,
				clientY,
				elementId: dragState.elementId,
				trackId: dragState.trackId,
				tracks,
				tracksContainerRef,
				tracksScrollRef,
				headerRef,
				zoomLevel,
				snappedTime: dragState.currentTime,
				verticalDragDirection: getVerticalDragDirection({
					startMouseY: dragState.startMouseY,
					currentMouseY: clientY,
				}),
			});
			if (!dropTarget) {
				endDrag();
				onSnapPointChange?.(null);
				return;
			}
			const snappedTime = dragState.currentTime;

			const sourceTrack = tracks.find(({ id }) => id === dragState.trackId);
			if (!sourceTrack) {
				endDrag();
				onSnapPointChange?.(null);
				return;
			}

			// Dragging a multi-selection: shift every selected clip by the same
			// delta, each staying on its own track. New-track drops fall back
			// to the single-element path below (out of scope for group drag).
			const groupDrag = groupDragRef.current;
			if (groupDrag && groupDrag.length > 1 && !dropTarget.isNewTrack) {
				const delta = snappedTime - dragState.startElementTime;
				const movingElementIds = new Set(groupDrag.map((g) => g.elementId));
				const updates = groupDrag.map((g) => ({
					trackId: g.trackId,
					elementId: g.elementId,
					newStartTime: Math.max(0, g.startTime + delta),
				}));

				const hasCollision = updates.some((update) => {
					const track = tracks.find((t) => t.id === update.trackId);
					const movingElement = track?.elements.find(
						(el) => el.id === update.elementId,
					);
					if (!track || !movingElement) return false;
					const otherElements = track.elements.filter(
						(el) => !movingElementIds.has(el.id),
					);
					return wouldElementOverlap({
						elements: otherElements,
						startTime: update.newStartTime,
						endTime: update.newStartTime + movingElement.duration,
					});
				});

				if (hasCollision) {
					toast.error("Can't move — clips would overlap");
				} else {
					editor.timeline.moveElements({ updates });
				}

				endDrag();
				onSnapPointChange?.(null);
				return;
			}

		if (dropTarget.isNewTrack) {
			const newTrackId = generateUUID();

			editor.timeline.moveElement({
				sourceTrackId: dragState.trackId,
				targetTrackId: newTrackId,
				elementId: dragState.elementId,
				newStartTime: snappedTime,
				createTrack: { type: sourceTrack.type, index: dropTarget.trackIndex },
				rippleEnabled: rippleEditingEnabled,
			});
			selectElement({ trackId: newTrackId, elementId: dragState.elementId });
		} else {
			const targetTrack = tracks[dropTarget.trackIndex];
			if (targetTrack) {
				editor.timeline.moveElement({
					sourceTrackId: dragState.trackId,
					targetTrackId: targetTrack.id,
					elementId: dragState.elementId,
					newStartTime: snappedTime,
					rippleEnabled: rippleEditingEnabled,
				});
				if (targetTrack.id !== dragState.trackId) {
					selectElement({ trackId: targetTrack.id, elementId: dragState.elementId });
				}
			}
		}

			endDrag();
			onSnapPointChange?.(null);
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [
		dragState.isDragging,
		dragState.elementId,
		dragState.startMouseY,
		dragState.trackId,
		dragState.currentTime,
		zoomLevel,
		tracks,
		endDrag,
		onSnapPointChange,
		editor.timeline,
		tracksContainerRef,
		tracksScrollRef,
		headerRef,
		rippleEditingEnabled,
		selectElement,
	]);

	useEffect(() => {
		if (!isPendingDrag) return;

		const handleMouseUp = () => {
			pendingDragRef.current = null;
			setIsPendingDrag(false);
			onSnapPointChange?.(null);
		};

		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [isPendingDrag, onSnapPointChange]);

	const handleElementMouseDown = useCallback(
		({
			event,
			element,
			track,
		}: {
			event: ReactMouseEvent;
			element: TimelineElement;
			track: TimelineTrack;
		}) => {
		const isRightClick = event.button === MOUSE_BUTTON_RIGHT;

		// right-click: don't stop propagation so ContextMenu can open
		if (isRightClick) {
				const alreadySelected = isElementSelected({
					trackId: track.id,
					elementId: element.id,
				});
				if (!alreadySelected) {
					handleSelectionClick({
						trackId: track.id,
						elementId: element.id,
						isMultiKey: false,
					});
				}
				return;
			}

		event.stopPropagation();
		mouseDownLocationRef.current = { x: event.clientX, y: event.clientY };

		const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;

		if (isMultiSelect) {
				handleSelectionClick({
					trackId: track.id,
					elementId: element.id,
					isMultiKey: true,
				});
				groupDragRef.current = null;
			} else if (
				selectedElements.length > 1 &&
				isElementSelected({ trackId: track.id, elementId: element.id })
			) {
				// Grabbing a clip that's part of a bigger selection: drag the
				// whole group together, each clip keeping its own track.
				groupDragRef.current = selectedElements
					.map((selected) => {
						const selectedTrack = tracks.find((t) => t.id === selected.trackId);
						const selectedElement = selectedTrack?.elements.find(
							(el) => el.id === selected.elementId,
						);
						return selectedElement
							? {
									trackId: selected.trackId,
									elementId: selected.elementId,
									startTime: selectedElement.startTime,
								}
							: null;
					})
					.filter((entry) => entry !== null);
			} else {
				groupDragRef.current = null;
			}

		const clickOffsetTime = getClickOffsetTime({
				clientX: event.clientX,
				elementRect: event.currentTarget.getBoundingClientRect(),
				zoomLevel,
			});
			pendingDragRef.current = {
				elementId: element.id,
				trackId: track.id,
				startMouseX: event.clientX,
				startMouseY: event.clientY,
				startElementTime: element.startTime,
				clickOffsetTime,
			};
			setIsPendingDrag(true);
		},
		[zoomLevel, isElementSelected, handleSelectionClick, selectedElements, tracks],
	);

	const handleElementClick = useCallback(
		({
			event,
			element,
			track,
		}: {
			event: ReactMouseEvent;
			element: TimelineElement;
			track: TimelineTrack;
		}) => {
		event.stopPropagation();

		if (mouseDownLocationRef.current) {
				const deltaX = Math.abs(event.clientX - mouseDownLocationRef.current.x);
				const deltaY = Math.abs(event.clientY - mouseDownLocationRef.current.y);
				if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
					mouseDownLocationRef.current = null;
					return;
				}
			}

			// modifier keys already handled in mousedown
			if (event.metaKey || event.ctrlKey || event.shiftKey) return;

		const alreadySelected = isElementSelected({
				trackId: track.id,
				elementId: element.id,
			});
			if (!alreadySelected) {
				selectElement({ trackId: track.id, elementId: element.id });
				return;
			}

			editor.selection.clearKeyframeSelection();
		},
		[editor.selection, isElementSelected, selectElement],
	);

	return {
		dragState,
		dragDropTarget,
		handleElementMouseDown,
		handleElementClick,
		lastMouseXRef,
	};
}
