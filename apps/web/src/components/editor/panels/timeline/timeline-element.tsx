"use client";

import { useEditor } from "@/hooks/use-editor";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import AudioWaveform from "./audio-waveform";
import { useTimelineElementResize } from "@/hooks/timeline/element/use-element-resize";
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

const KEYFRAME_INDICATOR_MIN_WIDTH_PX = 40;

interface KeyframeIndicator {
	time: number;
	offsetPx: number;
	keyframes: SelectedKeyframeRef[];
}

function buildKeyframeIndicator({
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

function getKeyframeIndicators({
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

function getDisplayShortcut(action: TAction) {
	const { defaultShortcuts } = getActionDefinition(action);
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
		e: React.MouseEvent,
		element: TimelineElementType,
	) => void;
	onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void;
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

	const mediaAssets = editor.media.getAssets();
	let mediaAsset: MediaAsset | null = null;

	if (hasMediaId(element)) {
		mediaAsset =
			mediaAssets.find((asset) => asset.id === element.mediaId) ?? null;
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
					className={`absolute top-0 h-full select-none`}
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
						hasAudio={hasAudio}
						isMuted={isMuted}
						mediaAssets={mediaAssets}
						onElementClick={onElementClick}
						onElementMouseDown={onElementMouseDown}
						handleResizeStart={handleResizeStart}
						isDropTarget={isDropTarget}
					/>
					{isSelected && <KeyframeIndicators indicators={keyframeIndicators} />}
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
	hasAudio,
	isMuted,
	mediaAssets,
	onElementClick,
	onElementMouseDown,
	handleResizeStart,
	isDropTarget = false,
}: {
	element: TimelineElementType;
	track: TimelineTrack;
	isSelected: boolean;
	hasAudio: boolean;
	isMuted: boolean;
	mediaAssets: MediaAsset[];
	onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void;
	onElementMouseDown: (
		e: React.MouseEvent,
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

	return (
		<div
			className={`relative h-full cursor-pointer overflow-hidden rounded-[0.5rem] ${getTrackClasses(
				{
					type: track.type,
				},
			)} ${opacityClass}`}
		>
			<button
				type="button"
				className="absolute inset-0 size-full cursor-pointer"
				onClick={(e) => onElementClick(e, element)}
				onMouseDown={(e) => onElementMouseDown(e, element)}
			>
				<div className="absolute inset-0 flex h-full items-center">
					<ElementContent
						element={element}
						track={track}
						isSelected={isSelected}
						mediaAssets={mediaAssets}
					/>
				</div>
				{(hasAudio
					? isMuted
					: canElementBeHidden(element) && element.hidden) && (
					<div className="bg-opacity-50 pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
						{hasAudio ? (
							<HugeiconsIcon
								icon={VolumeHighIcon}
								className="size-6 text-white"
							/>
						) : (
							<HugeiconsIcon
								icon={VolumeOffIcon}
								className="size-6 text-white"
							/>
						)}
					</div>
				)}
			</button>

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
			className={`bg-primary absolute top-0 bottom-0 flex w-[0.6rem] items-center justify-center ${isLeft ? "left-0 cursor-w-resize" : "right-0 cursor-e-resize"}`}
			onMouseDown={(event) => handleResizeStart({ event, elementId, side })}
			aria-label={`${isLeft ? "Left" : "Right"} resize handle`}
		>
			<div className="bg-foreground h-[1.5rem] w-[0.2rem] rounded-full" />
		</button>
	);
}

function KeyframeIndicators({
	indicators,
}: {
	indicators: KeyframeIndicator[];
}) {
	const { isKeyframeSelected, toggleKeyframeSelection, selectKeyframeRange } =
		useKeyframeSelection();
	const orderedKeyframes = indicators.flatMap(
		(indicator) => indicator.keyframes,
	);

	const handleKeyframeMouseDown = ({ event }: { event: React.MouseEvent }) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const handleKeyframeClick = ({
		event,
		keyframes,
	}: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
	}) => {
		event.stopPropagation();
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
	};

	return indicators.map((indicator) => {
		const isIndicatorSelected = indicator.keyframes.some((keyframe) =>
			isKeyframeSelected({ keyframe }),
		);

		return (
			<button
				key={indicator.time}
				type="button"
				className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
				style={{ left: indicator.offsetPx }}
				onMouseDown={(event) => handleKeyframeMouseDown({ event })}
				onClick={(event) =>
					handleKeyframeClick({ event, keyframes: indicator.keyframes })
				}
				aria-label="Select keyframe"
			>
				<HugeiconsIcon
					icon={KeyframeIcon}
					className={cn(
						"size-3.5 text-black",
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
	mediaAssets: MediaAsset[];
}

type ElementContentRenderer = (props: ElementContentProps) => ReactNode;

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
			<div className="flex size-full items-center justify-start pl-3">
				<span className="truncate text-xs text-white">
					{textElement.content}
				</span>
			</div>
		);
	},
	effect: ({ element }) => (
		<div className="flex size-full items-center justify-start gap-1 pl-2">
			<HugeiconsIcon icon={MagicWand05Icon} className="size-4 shrink-0 text-white" />
			<span className="truncate text-xs text-white">{element.name}</span>
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
	video: ({ element, track, isSelected, mediaAssets }) => {
		const videoElement = element as Extract<
			TimelineElementType,
			{ type: "video" }
		>;
		const mediaAsset = mediaAssets.find(
			(asset) => asset.id === videoElement.mediaId,
		);

		if (!mediaAsset) {
			return (
				<span className="text-foreground/80 truncate text-xs">
					{videoElement.name}
				</span>
			);
		}

		if (mediaAsset.thumbnailUrl) {
			const trackHeight = getTrackHeight({ type: track.type });
			const tileWidth = trackHeight * (16 / 9);

			return (
				<div className="flex size-full items-center justify-center">
					<div
						className={`relative size-full ${isSelected ? "bg-primary" : "bg-transparent"}`}
					>
						<div
							className="absolute right-0 left-0"
							style={{
								backgroundImage: `url(${mediaAsset.thumbnailUrl})`,
								backgroundRepeat: "repeat-x",
								backgroundSize: `${tileWidth}px ${trackHeight}px`,
								backgroundPosition: "left center",
								pointerEvents: "none",
								top: isSelected ? "0.25rem" : "0rem",
								bottom: isSelected ? "0.25rem" : "0rem",
							}}
						/>
					</div>
				</div>
			);
		}

		return (
			<span className="text-foreground/80 truncate text-xs">
				{videoElement.name}
			</span>
		);
	},
	image: ({ element, track, isSelected, mediaAssets }) => {
		const imageElement = element as Extract<
			TimelineElementType,
			{ type: "image" }
		>;
		const mediaAsset = mediaAssets.find(
			(asset) => asset.id === imageElement.mediaId,
		);

		if (!mediaAsset?.url) {
			return (
				<span className="text-foreground/80 truncate text-xs">
					{imageElement.name}
				</span>
			);
		}

		const trackHeight = getTrackHeight({ type: track.type });
		const tileWidth = trackHeight * (16 / 9);

		return (
			<div className="flex size-full items-center justify-center">
				<div
					className={`relative size-full ${isSelected ? "bg-primary" : "bg-transparent"}`}
				>
					<div
						className="absolute right-0 left-0"
						style={{
							backgroundImage: `url(${mediaAsset.url})`,
							backgroundRepeat: "repeat-x",
							backgroundSize: `${tileWidth}px ${trackHeight}px`,
							backgroundPosition: "left center",
							pointerEvents: "none",
							top: isSelected ? "0.25rem" : "0rem",
							bottom: isSelected ? "0.25rem" : "0rem",
						}}
					/>
				</div>
			</div>
		);
	},
};

function ElementContent(props: ElementContentProps) {
	const renderer = ELEMENT_CONTENT_RENDERERS[props.element.type];
	return <>{renderer(props)}</>;
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
			<HugeiconsIcon icon={VolumeHighIcon} />
		) : (
			<HugeiconsIcon icon={VolumeOffIcon} />
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
			textRight={getDisplayShortcut(action)}
			{...props}
		>
			{children}
		</ContextMenuItem>
	);
}
