"use client";

import { useEditor } from "@/hooks/use-editor";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import AudioWaveform from "./audio-waveform";
import { useTimelineElementResize } from "@/hooks/timeline/element/use-element-resize";
import {
	useKeyframeDrag,
	type KeyframeDragState,
} from "@/hooks/timeline/element/use-keyframe-drag";
import { useKeyframeSelection } from "@/hooks/timeline/element/use-keyframe-selection";
import type { SnapPoint } from "@/lib/timeline/snap-utils";
import { getElementKeyframes } from "@/lib/animation";
import {
	getTrackClasses,
	getTrackHeight,
	canElementHaveAudio,
	canElementBeHidden,
	hasMediaId,
	timelineTimeToPixels,
	timelineTimeToSnappedPixels,
} from "@/lib/timeline";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type {
	TimelineElement as TimelineElementType,
	TimelineTrack,
	VisualElement,
	ElementDragState,
} from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import { mediaSupportsAudio } from "@/lib/media/media-utils";
import { getActionDefinition, type TAction, invokeAction } from "@/lib/actions";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { resolveStickerId } from "@/lib/stickers";
import Image from "next/image";
import {
	ScissorIcon,
	Delete02Icon,
	Copy01Icon,
	ViewIcon,
	ViewOffSlashIcon,
	VolumeHighIcon,
	VolumeOffIcon,
	VolumeMute02Icon,
	Search01Icon,
	Exchange01Icon,
	KeyframeIcon,
	MagicWand05Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { uppercase } from "@/utils/string";
import type { ComponentProps, ReactNode } from "react";
import type { SelectedKeyframeRef, ElementKeyframe } from "@/types/animation";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { usePropertiesStore } from "@/stores/properties-store";

const KEYFRAME_INDICATOR_MIN_WIDTH_PX = 40;
const ELEMENT_RING_WIDTH_PX = 1.5;

interface KeyframeIndicator {
	time: number;
	offsetPx: number;
	keyframes: SelectedKeyframeRef[];
}

export function buildKeyframeIndicator({
	keyframe,
	trackId,
	elementId,
	displayedStartTime,
	zoomLevel,
	elementLeft,
}: {
	keyframe: ElementKeyframe;
	trackId: string;
	elementId: string;
	displayedStartTime: number;
	zoomLevel: number;
	elementLeft: number;
}): {
	time: number;
	offsetPx: number;
	keyframeRef: SelectedKeyframeRef;
} {
	const keyframeRef = {
		trackId,
		elementId,
		propertyPath: keyframe.propertyPath,
		keyframeId: keyframe.id,
	};
	const keyframeLeft = timelineTimeToSnappedPixels({
		time: displayedStartTime + keyframe.time,
		zoomLevel,
	});
	return {
		time: keyframe.time,
		offsetPx: keyframeLeft - elementLeft,
		keyframeRef,
	};
}

export function getKeyframeIndicators({
	keyframes,
	trackId,
	elementId,
	displayedStartTime,
	zoomLevel,
	elementLeft,
	elementWidth,
}: {
	keyframes: ElementKeyframe[];
	trackId: string;
	elementId: string;
	displayedStartTime: number;
	zoomLevel: number;
	elementLeft: number;
	elementWidth: number;
}): KeyframeIndicator[] {
	if (elementWidth < KEYFRAME_INDICATOR_MIN_WIDTH_PX) {
		return [];
	}

	const keyframesByTime = new Map<number, KeyframeIndicator>();
	for (const keyframe of keyframes) {
		const indicator = buildKeyframeIndicator({
			keyframe,
			trackId,
			elementId,
			displayedStartTime,
			zoomLevel,
			elementLeft,
		});
		const existingIndicator = keyframesByTime.get(indicator.time);
		if (!existingIndicator) {
			keyframesByTime.set(indicator.time, {
				time: indicator.time,
				offsetPx: indicator.offsetPx,
				keyframes: [indicator.keyframeRef],
			});
			continue;
		}

		existingIndicator.keyframes.push(indicator.keyframeRef);
	}

	return [...keyframesByTime.values()].sort((a, b) => a.time - b.time);
}

export function getDisplayShortcut({ action }: { action: TAction }) {
	const { defaultShortcuts } = getActionDefinition({ action });
	if (!defaultShortcuts?.length) {
		return "";
	}

	return uppercase({
		string: defaultShortcuts[0].replace("+", " "),
	});
}

interface TimelineElementProps {
	element: TimelineElementType;
	track: TimelineTrack;
	zoomLevel: number;
	isSelected: boolean;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
	onResizeStateChange?: (params: { isResizing: boolean }) => void;
	onElementMouseDown: (
		event: React.MouseEvent,
		element: TimelineElementType,
	) => void;
	onElementClick: (
		event: React.MouseEvent,
		element: TimelineElementType,
	) => void;
	dragState: ElementDragState;
	isDropTarget?: boolean;
}

export function TimelineElement({
	element,
	track,
	zoomLevel,
	isSelected,
	onSnapPointChange,
	onResizeStateChange,
	onElementMouseDown,
	onElementClick,
	dragState,
	isDropTarget = false,
}: TimelineElementProps) {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const { requestRevealMedia } = useAssetsPanelStore();

	let mediaAsset: MediaAsset | null = null;

	if (hasMediaId(element)) {
		mediaAsset =
			editor.media.getAssets().find((asset) => asset.id === element.mediaId) ??
			null;
	}

	const hasAudio = mediaSupportsAudio({ media: mediaAsset });

	const { handleResizeStart, isResizing, currentStartTime, currentDuration } =
		useTimelineElementResize({
			element,
			track,
			zoomLevel,
			onSnapPointChange,
			onResizeStateChange,
		});

	const isCurrentElementSelected = selectedElements.some(
		(selected) =>
			selected.elementId === element.id && selected.trackId === track.id,
	);

	const isBeingDragged = dragState.elementId === element.id;
	const dragOffsetY =
		isBeingDragged && dragState.isDragging
			? dragState.currentMouseY - dragState.startMouseY
			: 0;
	const elementStartTime =
		isBeingDragged && dragState.isDragging
			? dragState.currentTime
			: element.startTime;
	const displayedStartTime = isResizing ? currentStartTime : elementStartTime;
	const displayedDuration = isResizing ? currentDuration : element.duration;
	const elementWidth = timelineTimeToPixels({
		time: displayedDuration,
		zoomLevel,
	});
	const elementLeft = timelineTimeToSnappedPixels({
		time: displayedStartTime,
		zoomLevel,
	});
	const keyframeIndicators = isSelected
		? getKeyframeIndicators({
				keyframes: getElementKeyframes({ animations: element.animations }),
				trackId: track.id,
				elementId: element.id,
				displayedStartTime,
				zoomLevel,
				elementLeft,
				elementWidth,
			})
		: [];

	const {
		keyframeDragState,
		handleKeyframeMouseDown,
		handleKeyframeClick,
		getVisualOffsetPx,
	} = useKeyframeDrag({ zoomLevel, element, displayedStartTime });
	const handleRevealInMedia = ({ event }: { event: React.MouseEvent }) => {
		event.stopPropagation();
		if (hasMediaId(element)) {
			requestRevealMedia(element.mediaId);
		}
	};

	const isMuted = canElementHaveAudio(element) && element.muted === true;

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className="absolute top-0 h-full select-none"
					style={{
						left: `${elementLeft}px`,
						width: `${elementWidth}px`,
						transform:
							isBeingDragged && dragState.isDragging
								? `translate3d(0, ${dragOffsetY}px, 0)`
								: undefined,
					}}
				>
					<ElementInner
						element={element}
						track={track}
						isSelected={isSelected}
						onElementClick={onElementClick}
						onElementMouseDown={onElementMouseDown}
						handleResizeStart={handleResizeStart}
						isDropTarget={isDropTarget}
					/>
					{isSelected && (
						<div className="pointer-events-none absolute inset-0 overflow-hidden">
							<KeyframeIndicators
								indicators={keyframeIndicators}
								dragState={keyframeDragState}
								displayedStartTime={displayedStartTime}
								elementLeft={elementLeft}
								onKeyframeMouseDown={handleKeyframeMouseDown}
								onKeyframeClick={handleKeyframeClick}
								getVisualOffsetPx={getVisualOffsetPx}
							/>
						</div>
					)}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-64">
				<ActionMenuItem
					action="split"
					icon={<HugeiconsIcon icon={ScissorIcon} />}
				>
					Split
				</ActionMenuItem>
				<CopyMenuItem />
				{canElementHaveAudio(element) && hasAudio && (
					<MuteMenuItem
						isMultipleSelected={selectedElements.length > 1}
						isCurrentElementSelected={isCurrentElementSelected}
						isMuted={isMuted}
					/>
				)}
				{canElementBeHidden(element) && (
					<VisibilityMenuItem
						element={element}
						isMultipleSelected={selectedElements.length > 1}
						isCurrentElementSelected={isCurrentElementSelected}
					/>
				)}
				{selectedElements.length === 1 && (
					<ActionMenuItem
						action="duplicate-selected"
						icon={<HugeiconsIcon icon={Copy01Icon} />}
					>
						Duplicate
					</ActionMenuItem>
				)}
				{selectedElements.length === 1 && hasMediaId(element) && (
					<>
						<ContextMenuItem
							icon={<HugeiconsIcon icon={Search01Icon} />}
							onClick={(event: React.MouseEvent) =>
								handleRevealInMedia({ event })
							}
						>
							Reveal media
						</ContextMenuItem>
						<ContextMenuItem
							icon={<HugeiconsIcon icon={Exchange01Icon} />}
							disabled
						>
							Replace media
						</ContextMenuItem>
					</>
				)}
				<ContextMenuSeparator />
				<DeleteMenuItem
					isMultipleSelected={selectedElements.length > 1}
					isCurrentElementSelected={isCurrentElementSelected}
					elementType={element.type}
					selectedCount={selectedElements.length}
				/>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function ElementInner({
	element,
	track,
	isSelected,
	onElementClick,
	onElementMouseDown,
	handleResizeStart,
	isDropTarget = false,
}: {
	element: TimelineElementType;
	track: TimelineTrack;
	isSelected: boolean;
	onElementClick: (
		event: React.MouseEvent,
		element: TimelineElementType,
	) => void;
	onElementMouseDown: (
		event: React.MouseEvent,
		element: TimelineElementType,
	) => void;
	handleResizeStart: (params: {
		event: React.MouseEvent;
		elementId: string;
		side: "left" | "right";
	}) => void;
	isDropTarget?: boolean;
}) {
	const opacityClass =
		(canElementBeHidden(element) && element.hidden) || isDropTarget
			? "opacity-50"
			: "";
	const closeClipEffects = usePropertiesStore(
		(state) => state.closeClipEffects,
	);

	return (
		<div
			className="relative h-full cursor-pointer"
			style={{ marginInline: ELEMENT_RING_WIDTH_PX }}
		>
			<div
				className={cn(
					"absolute inset-0 overflow-hidden rounded-sm",
					getTrackClasses({ type: track.type }),
					opacityClass,
				)}
				style={
					isSelected
						? {
								boxShadow: `0 0 0 ${ELEMENT_RING_WIDTH_PX}px var(--foreground)`,
							}
						: undefined
				}
			>
				<button
					type="button"
					className="absolute inset-0 size-full cursor-pointer flex flex-col"
					onClick={(event) => {
						closeClipEffects();
						onElementClick(event, element);
					}}
					onMouseDown={(event) => onElementMouseDown(event, element)}
				>
					<div className="flex flex-1 min-h-0 items-center overflow-hidden">
						<ElementContent
							element={element}
							track={track}
							isSelected={isSelected}
						/>
					</div>
				</button>
			</div>

			{element.type !== "audio" && element.type !== "effect" && (
				<div className="sticky left-1 mt-1 ml-1 w-fit">
					<EffectsButton
						element={element as VisualElement}
						trackId={track.id}
					/>
				</div>
			)}

			{isSelected && (
				<>
					<ResizeHandle
						side="left"
						elementId={element.id}
						handleResizeStart={handleResizeStart}
					/>
					<ResizeHandle
						side="right"
						elementId={element.id}
						handleResizeStart={handleResizeStart}
					/>
				</>
			)}
		</div>
	);
}

function ResizeHandle({
	side,
	elementId,
	handleResizeStart,
}: {
	side: "left" | "right";
	elementId: string;
	handleResizeStart: (params: {
		event: React.MouseEvent;
		elementId: string;
		side: "left" | "right";
	}) => void;
}) {
	const isLeft = side === "left";
	return (
		<button
			type="button"
			className={cn(
				"absolute top-0 bottom-0 w-2",
				isLeft ? "-left-1 cursor-w-resize" : "-right-1 cursor-e-resize",
			)}
			onMouseDown={(event) => handleResizeStart({ event, elementId, side })}
			onClick={(event) => event.stopPropagation()}
			aria-label={`${isLeft ? "Left" : "Right"} resize handle`}
		></button>
	);
}

function KeyframeIndicators({
	indicators,
	dragState,
	displayedStartTime,
	elementLeft,
	onKeyframeMouseDown,
	onKeyframeClick,
	getVisualOffsetPx,
}: {
	indicators: KeyframeIndicator[];
	dragState: KeyframeDragState;
	displayedStartTime: number;
	elementLeft: number;
	onKeyframeMouseDown: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
	}) => void;
	onKeyframeClick: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
		orderedKeyframes: SelectedKeyframeRef[];
		indicatorTime: number;
	}) => void;
	getVisualOffsetPx: (params: {
		indicatorTime: number;
		indicatorOffsetPx: number;
		isBeingDragged: boolean;
		displayedStartTime: number;
		elementLeft: number;
	}) => number;
}) {
	const { isKeyframeSelected } = useKeyframeSelection();
	const orderedKeyframes = indicators.flatMap(
		(indicator) => indicator.keyframes,
	);

	return indicators.map((indicator) => {
		const isIndicatorSelected = indicator.keyframes.some((keyframe) =>
			isKeyframeSelected({ keyframe }),
		);
		const isBeingDragged = indicator.keyframes.some((kf) =>
			dragState.draggingKeyframeIds.has(kf.keyframeId),
		);
		const visualOffsetPx = getVisualOffsetPx({
			indicatorTime: indicator.time,
			indicatorOffsetPx: indicator.offsetPx,
			isBeingDragged,
			displayedStartTime,
			elementLeft,
		});

		return (
			<button
				key={indicator.time}
				type="button"
				className="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab"
				style={{ left: visualOffsetPx }}
				onMouseDown={(event) =>
					onKeyframeMouseDown({ event, keyframes: indicator.keyframes })
				}
				onClick={(event) =>
					onKeyframeClick({
						event,
						keyframes: indicator.keyframes,
						orderedKeyframes,
						indicatorTime: indicator.time,
					})
				}
				aria-label="Select keyframe"
			>
				<HugeiconsIcon
					icon={KeyframeIcon}
					className={cn(
						"size-3.5 mt-1.5 text-black",
						isIndicatorSelected ? "fill-primary" : "fill-white",
					)}
					strokeWidth={1.5}
				/>
			</button>
		);
	});
}

interface ElementContentProps {
	element: TimelineElementType;
	track: TimelineTrack;
	isSelected: boolean;
}

interface ElementContentRendererProps extends ElementContentProps {
	mediaAssets: MediaAsset[];
}

type ElementContentRenderer = (props: ElementContentRendererProps) => ReactNode;

export function renderTiledMedia({
	element,
	imageUrl,
	track,
}: {
	element: VisualElement;
	imageUrl: string | undefined;
	track: ElementContentProps["track"];
}): ReactNode {
	if (!imageUrl) {
		return (
			<span className="text-foreground/80 truncate text-xs">
				{element.name}
			</span>
		);
	}

	const trackHeight = getTrackHeight({ type: track.type });
	const tileWidth = trackHeight * (16 / 9);

	return (
		<div
			className="absolute inset-0"
			style={{
				backgroundImage: `url(${imageUrl})`,
				backgroundRepeat: "repeat-x",
				backgroundSize: `${tileWidth}px ${trackHeight}px`,
				backgroundPosition: "left center",
				pointerEvents: "none",
			}}
		/>
	);
}

function EffectsButton({
	element,
	trackId,
	className,
}: {
	element: VisualElement;
	trackId: string;
	className?: string;
}) {
	const openClipEffects = usePropertiesStore((state) => state.openClipEffects);
	const { selectElement } = useElementSelection();

	if (!element.effects?.length) {
		return null;
	}

	const handleClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		selectElement({ elementId: element.id, trackId });
		openClipEffects({ elementId: element.id, trackId });
	};

	return (
		<Button
			variant="text"
			size="icon"
			className={cn("rounded-sm !size-5 bg-black/50 text-white", className)}
			onClick={handleClick}
			onMouseDown={(event) => event.stopPropagation()}
		>
			<HugeiconsIcon icon={MagicWand05Icon} />
		</Button>
	);
}

const ELEMENT_CONTENT_RENDERERS: Record<
	TimelineElementType["type"],
	ElementContentRenderer
> = {
	text: ({ element }) => {
		const textElement = element as Extract<
			TimelineElementType,
			{ type: "text" }
		>;
		return (
			<div className="flex size-full items-center justify-start pl-2">
				<span className="truncate text-xs text-white">
					{textElement.content}
				</span>
			</div>
		);
	},
	effect: ({ element }) => (
		<div className="flex size-full items-center justify-start gap-1 pl-2">
			<HugeiconsIcon
				icon={MagicWand05Icon}
				className="size-4 shrink-0 text-white"
			/>
			<span className="truncate text-xs text-white ml-1">{element.name}</span>
		</div>
	),
	sticker: ({ element }) => {
		const stickerElement = element as Extract<
			TimelineElementType,
			{ type: "sticker" }
		>;
		return (
			<div className="flex size-full items-center gap-2 pl-2">
				<Image
					src={resolveStickerId({
						stickerId: stickerElement.stickerId,
						options: { width: 20, height: 20 },
					})}
					alt={stickerElement.name}
					className="size-5 shrink-0"
					width={20}
					height={20}
					unoptimized
				/>
				<span className="truncate text-xs text-white">
					{stickerElement.name}
				</span>
			</div>
		);
	},
	audio: ({ element, mediaAssets }) => {
		const audioElement = element as Extract<
			TimelineElementType,
			{ type: "audio" }
		>;
		const audioBuffer =
			audioElement.sourceType === "library" ? audioElement.buffer : undefined;
		const audioUrl =
			audioElement.sourceType === "library"
				? audioElement.sourceUrl
				: mediaAssets.find((asset) => asset.id === audioElement.mediaId)?.url;

		if (audioBuffer || audioUrl) {
			return (
				<div className="flex size-full items-center gap-2">
					<div className="min-w-0 flex-1">
						<AudioWaveform
							audioBuffer={audioBuffer}
							audioUrl={audioUrl}
							height={24}
							className="w-full"
						/>
					</div>
				</div>
			);
		}

		return (
			<span className="text-foreground/80 truncate text-xs">
				{audioElement.name}
			</span>
		);
	},
	video: ({ element, track, mediaAssets }) => {
		const videoElement = element as Extract<
			TimelineElementType,
			{ type: "video" }
		>;
		const mediaAsset = mediaAssets.find(
			(asset) => asset.id === videoElement.mediaId,
		);
		return renderTiledMedia({
			element: videoElement,
			imageUrl: mediaAsset?.thumbnailUrl,
			track,
		});
	},
	image: ({ element, track, mediaAssets }) => {
		const imageElement = element as Extract<
			TimelineElementType,
			{ type: "image" }
		>;
		const mediaAsset = mediaAssets.find(
			(asset) => asset.id === imageElement.mediaId,
		);
		return renderTiledMedia({
			element: imageElement,
			imageUrl: mediaAsset?.url,
			track,
		});
	},
};

function ElementContent({ element, track, isSelected }: ElementContentProps) {
	const editor = useEditor();
	const renderer = ELEMENT_CONTENT_RENDERERS[element.type];
	return (
		<>
			{renderer({
				element,
				track,
				isSelected,
				mediaAssets: editor.media.getAssets(),
			})}
		</>
	);
}

function CopyMenuItem() {
	return (
		<ActionMenuItem
			action="copy-selected"
			icon={<HugeiconsIcon icon={Copy01Icon} />}
		>
			Copy
		</ActionMenuItem>
	);
}

function MuteMenuItem({
	isMultipleSelected,
	isCurrentElementSelected,
	isMuted,
}: {
	isMultipleSelected: boolean;
	isCurrentElementSelected: boolean;
	isMuted: boolean;
}) {
	const getIcon = () => {
		if (isMultipleSelected && isCurrentElementSelected) {
			return <HugeiconsIcon icon={VolumeMute02Icon} />;
		}
		return isMuted ? (
			<HugeiconsIcon icon={VolumeOffIcon} />
		) : (
			<HugeiconsIcon icon={VolumeHighIcon} />
		);
	};

	return (
		<ActionMenuItem action="toggle-elements-muted-selected" icon={getIcon()}>
			{isMuted ? "Unmute" : "Mute"}
		</ActionMenuItem>
	);
}

function VisibilityMenuItem({
	element,
	isMultipleSelected,
	isCurrentElementSelected,
}: {
	element: TimelineElementType;
	isMultipleSelected: boolean;
	isCurrentElementSelected: boolean;
}) {
	const isHidden = canElementBeHidden(element) && element.hidden;

	const getIcon = () => {
		if (isMultipleSelected && isCurrentElementSelected) {
			return <HugeiconsIcon icon={ViewOffSlashIcon} />;
		}
		return isHidden ? (
			<HugeiconsIcon icon={ViewIcon} />
		) : (
			<HugeiconsIcon icon={ViewOffSlashIcon} />
		);
	};

	return (
		<ActionMenuItem
			action="toggle-elements-visibility-selected"
			icon={getIcon()}
		>
			{isHidden ? "Show" : "Hide"}
		</ActionMenuItem>
	);
}

function DeleteMenuItem({
	isMultipleSelected,
	isCurrentElementSelected,
	elementType,
	selectedCount,
}: {
	isMultipleSelected: boolean;
	isCurrentElementSelected: boolean;
	elementType: TimelineElementType["type"];
	selectedCount: number;
}) {
	return (
		<ActionMenuItem
			action="delete-selected"
			variant="destructive"
			icon={<HugeiconsIcon icon={Delete02Icon} />}
		>
			{isMultipleSelected && isCurrentElementSelected
				? `Delete ${selectedCount} elements`
				: `Delete ${elementType === "text" ? "text" : "clip"}`}
		</ActionMenuItem>
	);
}

function ActionMenuItem({
	action,
	children,
	...props
}: Omit<ComponentProps<typeof ContextMenuItem>, "onClick" | "textRight"> & {
	action: TAction;
	children: ReactNode;
}) {
	return (
		<ContextMenuItem
			onClick={(event: React.MouseEvent) => {
				event.stopPropagation();
				invokeAction(action);
			}}
			textRight={getDisplayShortcut({ action })}
			{...props}
		>
			{children}
		</ContextMenuItem>
	);
}
