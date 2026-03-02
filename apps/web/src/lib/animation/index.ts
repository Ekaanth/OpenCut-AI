export {
	getChannelValueAtTime,
	getNumberChannelValueAtTime,
	normalizeChannel,
} from "./interpolation";

export {
	clampAnimationsToDuration,
	cloneAnimations,
	getChannel,
	removeElementKeyframe,
	retimeElementKeyframe,
	setChannel,
	splitAnimationsAtTime,
	upsertElementKeyframe,
} from "./keyframes";

export {
	getElementLocalTime,
	resolveColorAtTime,
	resolveOpacityAtTime,
	resolveTransformAtTime,
	resolveVolumeAtTime,
} from "./resolve";

export {
	coerceAnimationValueForProperty,
	getAnimationPropertyDefinition,
	getDefaultInterpolationForProperty,
	getElementBaseValueForProperty,
	isAnimationPropertyPath,
	supportsAnimationProperty,
	withElementBaseValueForProperty,
} from "./property-registry";

export {
	getElementKeyframes,
	getKeyframeAtTime,
	hasKeyframesForPath,
} from "./keyframe-query";
