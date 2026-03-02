export const ANIMATION_PROPERTY_PATHS = [
	"transform.position.x",
	"transform.position.y",
	"transform.scale",
	"transform.rotate",
	"opacity",
	"volume",
	"color",
	"background.color",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
	"background.cornerRadius",
] as const;

export type AnimationPropertyPath = (typeof ANIMATION_PROPERTY_PATHS)[number];

export type AnimationValueKind = "number" | "color" | "discrete";
export type DiscreteValue = boolean | string;
export type AnimationValue = number | string | boolean;

export type ContinuousKeyframeInterpolation = "linear" | "hold";
export type DiscreteKeyframeInterpolation = "hold";
export type AnimationInterpolation =
	| ContinuousKeyframeInterpolation
	| DiscreteKeyframeInterpolation;

interface BaseAnimationKeyframe<
	TValue extends AnimationValue,
	TInterpolation extends AnimationInterpolation,
> {
	id: string;
	time: number; // relative to element start time
	value: TValue;
	interpolation: TInterpolation;
}

export interface NumberKeyframe
	extends BaseAnimationKeyframe<number, ContinuousKeyframeInterpolation> {}

export interface ColorKeyframe
	extends BaseAnimationKeyframe<string, ContinuousKeyframeInterpolation> {}

export interface DiscreteKeyframe
	extends BaseAnimationKeyframe<DiscreteValue, DiscreteKeyframeInterpolation> {}

export type AnimationKeyframe =
	| NumberKeyframe
	| ColorKeyframe
	| DiscreteKeyframe;

interface BaseAnimationChannel<
	TValueKind extends AnimationValueKind,
	TKeyframe extends AnimationKeyframe,
> {
	valueKind: TValueKind;
	keyframes: TKeyframe[];
}

export interface NumberAnimationChannel
	extends BaseAnimationChannel<"number", NumberKeyframe> {}

export interface ColorAnimationChannel
	extends BaseAnimationChannel<"color", ColorKeyframe> {}

export interface DiscreteAnimationChannel
	extends BaseAnimationChannel<"discrete", DiscreteKeyframe> {}

export type AnimationChannel =
	| NumberAnimationChannel
	| ColorAnimationChannel
	| DiscreteAnimationChannel;

export type ElementAnimationChannelMap = Record<
	string,
	AnimationChannel | undefined
>;

export interface ElementAnimations {
	channels: ElementAnimationChannelMap;
}

export interface ElementKeyframe {
	propertyPath: AnimationPropertyPath;
	id: string;
	time: number;
	value: AnimationValue;
	interpolation: AnimationInterpolation;
}

export interface SelectedKeyframeRef {
	trackId: string;
	elementId: string;
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
}
