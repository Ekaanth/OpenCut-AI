import type { ElementAnimations } from "./animation";
import type { Effect, EffectParamValues } from "./effects";
import type { BlendMode, Transform } from "./rendering";

export interface Bookmark {
	time: number;
	note?: string;
	color?: string;
	duration?: number;
}

export interface TScene {
	id: string;
	name: string;
	isMain: boolean;
	tracks: TimelineTrack[];
	bookmarks: Bookmark[];
	createdAt: Date;
	updatedAt: Date;
}

export type TrackType = "video" | "text" | "audio" | "sticker" | "effect";

interface BaseTrack {
	id: string;
	name: string;
}

export interface VideoTrack extends BaseTrack {
	type: "video";
	elements: (VideoElement | ImageElement)[];
	isMain: boolean;
	muted: boolean;
	hidden: boolean;
}

export interface TextTrack extends BaseTrack {
	type: "text";
	elements: TextElement[];
	hidden: boolean;
}

export interface AudioTrack extends BaseTrack {
	type: "audio";
	elements: AudioElement[];
	muted: boolean;
}

export interface StickerTrack extends BaseTrack {
	type: "sticker";
	elements: StickerElement[];
	hidden: boolean;
}

export interface EffectTrack extends BaseTrack {
	type: "effect";
	elements: EffectElement[];
	hidden: boolean;
}

export type TimelineTrack =
	| VideoTrack
	| TextTrack
	| AudioTrack
	| StickerTrack
	| EffectTrack;

export type { Transform } from "./rendering";

interface BaseAudioElement extends BaseTimelineElement {
	type: "audio";
	volume: number;
	muted?: boolean;
	buffer?: AudioBuffer;
}

export interface UploadAudioElement extends BaseAudioElement {
	sourceType: "upload";
	mediaId: string;
}

export interface LibraryAudioElement extends BaseAudioElement {
	sourceType: "library";
	sourceUrl: string;
}

export type AudioElement = UploadAudioElement | LibraryAudioElement;

interface BaseTimelineElement {
	id: string;
	name: string;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
	sourceDuration?: number;
	animations?: ElementAnimations;
}

export interface VideoElement extends BaseTimelineElement {
	type: "video";
	mediaId: string;
	muted?: boolean;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export interface ImageElement extends BaseTimelineElement {
	type: "image";
	mediaId: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export interface TextBackground {
	enabled: boolean;
	color: string;
	cornerRadius?: number;
	paddingX?: number;
	paddingY?: number;
	offsetX?: number;
	offsetY?: number;
}

export interface TextElement extends BaseTimelineElement {
	type: "text";
	content: string;
	fontSize: number;
	fontFamily: string;
	color: string;
	background: TextBackground;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline" | "line-through";
	letterSpacing?: number;
	lineHeight?: number;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export interface StickerElement extends BaseTimelineElement {
	type: "sticker";
	stickerId: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
}

export interface EffectElement extends BaseTimelineElement {
	type: "effect";
	effectType: string;
	params: EffectParamValues;
}

export type VisualElement =
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement;

export type ElementUpdatePatch =
	| { transform: Transform }
	| { opacity: number }
	| { volume: number };

export type TimelineElement =
	| AudioElement
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement
	| EffectElement;

export type ElementType = TimelineElement["type"];

export type CreateUploadAudioElement = Omit<UploadAudioElement, "id">;
export type CreateLibraryAudioElement = Omit<LibraryAudioElement, "id">;
export type CreateAudioElement =
	| CreateUploadAudioElement
	| CreateLibraryAudioElement;
export type CreateVideoElement = Omit<VideoElement, "id">;
export type CreateImageElement = Omit<ImageElement, "id">;
export type CreateTextElement = Omit<TextElement, "id">;
export type CreateStickerElement = Omit<StickerElement, "id">;
export type CreateEffectElement = Omit<EffectElement, "id">;
export type CreateTimelineElement =
	| CreateAudioElement
	| CreateVideoElement
	| CreateImageElement
	| CreateTextElement
	| CreateStickerElement
	| CreateEffectElement;

export interface ElementDragState {
	isDragging: boolean;
	elementId: string | null;
	trackId: string | null;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
	currentTime: number;
	currentMouseY: number;
}

export interface DropTarget {
	trackIndex: number;
	isNewTrack: boolean;
	insertPosition: "above" | "below" | null;
	xPosition: number;
	targetElement: { elementId: string; trackId: string } | null;
}

export interface ComputeDropTargetParams {
	elementType: ElementType;
	mouseX: number;
	mouseY: number;
	tracks: TimelineTrack[];
	playheadTime: number;
	isExternalDrop: boolean;
	elementDuration: number;
	pixelsPerSecond: number;
	zoomLevel: number;
	verticalDragDirection?: "up" | "down" | null;
	startTimeOverride?: number;
	excludeElementId?: string;
	targetElementTypes?: string[];
}

export interface ClipboardItem {
	trackId: string;
	trackType: TrackType;
	element: CreateTimelineElement;
}
