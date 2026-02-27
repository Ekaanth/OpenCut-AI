import type {
	AnimationChannel,
	AnimationInterpolation,
	AnimationKeyframe,
	AnimationPropertyPath,
	AnimationValue,
	AnimationValueKind,
	ColorAnimationChannel,
	DiscreteAnimationChannel,
	ElementAnimations,
	NumberAnimationChannel,
} from "@/types/animation";
import { TIME_EPSILON_SECONDS } from "@/constants/animation-constants";
import { generateUUID } from "@/utils/id";
import { getChannelValueAtTime, normalizeChannel } from "./interpolation";
import {
	coerceAnimationValueForProperty,
	getDefaultInterpolationForProperty,
	getAnimationPropertyDefinition,
	isAnimationPropertyPath,
} from "./property-registry";

function isNearlySameTime({
	leftTime,
	rightTime,
}: {
	leftTime: number;
	rightTime: number;
}): boolean {
	return Math.abs(leftTime - rightTime) <= TIME_EPSILON_SECONDS;
}

function toAnimation({
	channelEntries,
}: {
	channelEntries: Array<[string, AnimationChannel]>;
}): ElementAnimations | undefined {
	if (channelEntries.length === 0) {
		return undefined;
	}

	return {
		channels: Object.fromEntries(channelEntries),
	};
}

function toChannel({
	keyframes,
	valueKind,
}: {
	keyframes: AnimationKeyframe[];
	valueKind: AnimationValueKind;
}): AnimationChannel {
	return normalizeChannel({
		channel: {
			valueKind,
			keyframes,
		} as AnimationChannel,
	});
}

export function getChannel({
	animations,
	propertyPath,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: string;
}): AnimationChannel | undefined {
	return animations?.channels[propertyPath];
}

function getInterpolationForChannel({
	channel,
	interpolation,
}: {
	channel: AnimationChannel;
	interpolation: AnimationInterpolation | undefined;
}): AnimationInterpolation {
	if (channel.valueKind === "discrete") {
		return "hold";
	}

	if (interpolation === "linear" || interpolation === "hold") {
		return interpolation;
	}

	return "linear";
}

function buildKeyframe({
	channel,
	id,
	time,
	value,
	interpolation,
}: {
	channel: AnimationChannel;
	id: string;
	time: number;
	value: AnimationValue;
	interpolation: AnimationInterpolation;
}): AnimationKeyframe {
	if (channel.valueKind === "number") {
		if (typeof value !== "number") {
			throw new Error("Number channel keyframes require numeric values");
		}

		return {
			id,
			time,
			value,
			interpolation: interpolation === "hold" ? "hold" : "linear",
		};
	}

	if (channel.valueKind === "color") {
		if (typeof value !== "string") {
			throw new Error("Color channel keyframes require string values");
		}

		return {
			id,
			time,
			value,
			interpolation: interpolation === "hold" ? "hold" : "linear",
		};
	}

	if (typeof value !== "string" && typeof value !== "boolean") {
		throw new Error("Discrete channel keyframes require boolean or string values");
	}

	return {
		id,
		time,
		value,
		interpolation: "hold",
	};
}

function createEmptyChannel({
	propertyPath,
}: {
	propertyPath: AnimationPropertyPath;
}): AnimationChannel {
	const propertyDefinition = getAnimationPropertyDefinition({ propertyPath });
	if (propertyDefinition.valueKind === "number") {
		return { valueKind: "number", keyframes: [] } satisfies NumberAnimationChannel;
	}

	if (propertyDefinition.valueKind === "color") {
		return { valueKind: "color", keyframes: [] } satisfies ColorAnimationChannel;
	}

	return { valueKind: "discrete", keyframes: [] } satisfies DiscreteAnimationChannel;
}

export function upsertKeyframe({
	channel,
	time,
	value,
	interpolation,
	keyframeId,
}: {
	channel: AnimationChannel | undefined;
	time: number;
	value: AnimationValue;
	interpolation?: AnimationInterpolation;
	keyframeId?: string;
}): AnimationChannel | undefined {
	if (!channel) {
		return undefined;
	}

	const currentKeyframes = channel.keyframes;
	const nextKeyframes = [...currentKeyframes];
	const nextInterpolation = getInterpolationForChannel({
		channel,
		interpolation,
	});
	if (keyframeId) {
		const keyframeByIdIndex = nextKeyframes.findIndex(
			(keyframe) => keyframe.id === keyframeId,
		);
		if (keyframeByIdIndex >= 0) {
			nextKeyframes[keyframeByIdIndex] = buildKeyframe({
				channel,
				id: nextKeyframes[keyframeByIdIndex].id,
				time,
				value,
				interpolation: nextInterpolation,
			});
			return toChannel({
				keyframes: nextKeyframes,
				valueKind: channel.valueKind,
			});
		}
	}

	const keyframeAtTimeIndex = nextKeyframes.findIndex((keyframe) =>
		isNearlySameTime({ leftTime: keyframe.time, rightTime: time }),
	);
	if (keyframeAtTimeIndex >= 0) {
		nextKeyframes[keyframeAtTimeIndex] = buildKeyframe({
			channel,
			id: nextKeyframes[keyframeAtTimeIndex].id,
			time: nextKeyframes[keyframeAtTimeIndex].time,
			value,
			interpolation: nextInterpolation,
		});
		return toChannel({
			keyframes: nextKeyframes,
			valueKind: channel.valueKind,
		});
	}

	nextKeyframes.push(
		buildKeyframe({
			channel,
			id: keyframeId ?? generateUUID(),
			time,
			value,
			interpolation: nextInterpolation,
		}),
	);

	return toChannel({
		keyframes: nextKeyframes,
		valueKind: channel.valueKind,
	});
}

export function removeKeyframe({
	channel,
	keyframeId,
}: {
	channel: AnimationChannel | undefined;
	keyframeId: string;
}): AnimationChannel | undefined {
	if (!channel) {
		return undefined;
	}

	const nextKeyframes = channel.keyframes.filter(
		(keyframe) => keyframe.id !== keyframeId,
	);
	if (nextKeyframes.length === 0) {
		return undefined;
	}

	return toChannel({
		keyframes: nextKeyframes,
		valueKind: channel.valueKind,
	});
}

export function retimeKeyframe({
	channel,
	keyframeId,
	time,
}: {
	channel: AnimationChannel | undefined;
	keyframeId: string;
	time: number;
}): AnimationChannel | undefined {
	if (!channel) {
		return undefined;
	}

	const keyframeByIdIndex = channel.keyframes.findIndex(
		(keyframe) => keyframe.id === keyframeId,
	);
	if (keyframeByIdIndex < 0) {
		return channel;
	}

	const nextKeyframes = [...channel.keyframes];
	nextKeyframes[keyframeByIdIndex] = {
		...nextKeyframes[keyframeByIdIndex],
		time,
	};

	return toChannel({
		keyframes: nextKeyframes,
		valueKind: channel.valueKind,
	});
}

export function setChannel({
	animations,
	propertyPath,
	channel,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: string;
	channel: AnimationChannel | undefined;
}): ElementAnimations | undefined {
	const currentChannels = animations?.channels ?? {};

	const nextChannelEntries = Object.entries(currentChannels)
		.filter(([path]) => path !== propertyPath)
		.filter(([, ch]) => ch && ch.keyframes.length > 0)
		.map(([path, ch]) => [path, ch] as [string, AnimationChannel]);

	if (channel && channel.keyframes.length > 0) {
		nextChannelEntries.push([propertyPath, channel]);
	}

	return toAnimation({
		channelEntries: nextChannelEntries,
	});
}

export function cloneAnimations({
	animations,
	shouldRegenerateKeyframeIds = false,
}: {
	animations: ElementAnimations | undefined;
	shouldRegenerateKeyframeIds?: boolean;
}): ElementAnimations | undefined {
	if (!animations) {
		return undefined;
	}

	const clonedEntries = Object.entries(animations.channels).flatMap(
		([propertyPath, channel]) => {
			if (!channel || channel.keyframes.length === 0) {
				return [];
			}

			const clonedKeyframes = channel.keyframes.map((keyframe) => ({
				...keyframe,
				id: shouldRegenerateKeyframeIds ? generateUUID() : keyframe.id,
			}));

			return [
				[
					propertyPath,
					toChannel({
						keyframes: clonedKeyframes,
						valueKind: channel.valueKind,
					}),
				] as [string, AnimationChannel],
			];
		},
	);

	return toAnimation({
		channelEntries: clonedEntries,
	});
}

export function clampAnimationsToDuration({
	animations,
	duration,
}: {
	animations: ElementAnimations | undefined;
	duration: number;
}): ElementAnimations | undefined {
	if (!animations) {
		return undefined;
	}

	const clampedEntries = Object.entries(animations.channels).flatMap(
		([propertyPath, channel]) => {
			if (!channel) {
				return [];
			}

			const nextKeyframes = channel.keyframes.filter(
				(keyframe) => keyframe.time >= 0 && keyframe.time <= duration,
			);
			if (nextKeyframes.length === 0) {
				return [];
			}

			return [
				[
					propertyPath,
					toChannel({
						keyframes: nextKeyframes,
						valueKind: channel.valueKind,
					}),
				] as [string, AnimationChannel],
			];
		},
	);

	return toAnimation({
		channelEntries: clampedEntries,
	});
}

export function splitAnimationsAtTime({
	animations,
	splitTime,
	shouldIncludeSplitBoundary = true,
}: {
	animations: ElementAnimations | undefined;
	splitTime: number;
	shouldIncludeSplitBoundary?: boolean;
}): {
	leftAnimations: ElementAnimations | undefined;
	rightAnimations: ElementAnimations | undefined;
} {
	if (!animations) {
		return { leftAnimations: undefined, rightAnimations: undefined };
	}

	const leftChannels: Array<[string, AnimationChannel]> = [];
	const rightChannels: Array<[string, AnimationChannel]> = [];

	for (const [propertyPath, channel] of Object.entries(animations.channels)) {
		if (!channel || channel.keyframes.length === 0) {
			continue;
		}

		const normalizedChannel = normalizeChannel({ channel });
		let leftKeyframes = normalizedChannel.keyframes.filter(
			(keyframe) => keyframe.time <= splitTime,
		);
		let rightKeyframes = normalizedChannel.keyframes
			.filter((keyframe) => keyframe.time >= splitTime)
			.map((keyframe) => ({
				...keyframe,
				time: keyframe.time - splitTime,
			}));

		const hasBoundaryOnLeft = leftKeyframes.some((keyframe) =>
			isNearlySameTime({ leftTime: keyframe.time, rightTime: splitTime }),
		);
		const hasBoundaryOnRight = rightKeyframes.some((keyframe) =>
			isNearlySameTime({ leftTime: keyframe.time, rightTime: 0 }),
		);
		if (shouldIncludeSplitBoundary && (!hasBoundaryOnLeft || !hasBoundaryOnRight)) {
			const boundaryValue = getChannelValueAtTime({
				channel: normalizedChannel,
				time: splitTime,
				fallbackValue: normalizedChannel.keyframes[0].value,
			});
			const knownPropertyPath = isAnimationPropertyPath({ propertyPath })
				? (propertyPath as AnimationPropertyPath)
				: null;
			const boundaryInterpolation = knownPropertyPath
				? getDefaultInterpolationForProperty({ propertyPath: knownPropertyPath })
				: normalizedChannel.valueKind === "discrete"
					? "hold"
					: "linear";

			if (!hasBoundaryOnLeft) {
				leftKeyframes = [
					...leftKeyframes,
					buildKeyframe({
						channel: normalizedChannel,
						id: generateUUID(),
						time: splitTime,
						value: boundaryValue,
						interpolation: boundaryInterpolation,
					}),
				];
			}

			if (!hasBoundaryOnRight) {
				rightKeyframes = [
					buildKeyframe({
						channel: normalizedChannel,
						id: generateUUID(),
						time: 0,
						value: boundaryValue,
						interpolation: boundaryInterpolation,
					}),
					...rightKeyframes,
				];
			}
		}

		const leftChannel = leftKeyframes.length
			? toChannel({
					keyframes: leftKeyframes,
					valueKind: normalizedChannel.valueKind,
				})
			: undefined;
		const rightChannel = rightKeyframes.length
			? toChannel({
					keyframes: rightKeyframes,
					valueKind: normalizedChannel.valueKind,
				})
			: undefined;
		if (leftChannel) {
			leftChannels.push([propertyPath, leftChannel]);
		}
		if (rightChannel) {
			rightChannels.push([propertyPath, rightChannel]);
		}
	}

	return {
		leftAnimations: toAnimation({ channelEntries: leftChannels }),
		rightAnimations: toAnimation({ channelEntries: rightChannels }),
	};
}

export function upsertElementKeyframe({
	animations,
	propertyPath,
	time,
	value,
	interpolation,
	keyframeId,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	time: number;
	value: AnimationValue;
	interpolation?: AnimationInterpolation;
	keyframeId?: string;
}): ElementAnimations | undefined {
	const coercedValue = coerceAnimationValueForProperty({
		propertyPath,
		value,
	});
	if (coercedValue === null) {
		return animations;
	}

	const defaultInterpolation = getDefaultInterpolationForProperty({ propertyPath });
	const propertyDefinition = getAnimationPropertyDefinition({ propertyPath });
	const channel = getChannel({ animations, propertyPath });
	const targetChannel =
		channel && channel.valueKind === propertyDefinition.valueKind
			? channel
			: createEmptyChannel({ propertyPath });
	const updatedChannel = upsertKeyframe({
		channel: targetChannel,
		time,
		value: coercedValue,
		interpolation: interpolation ?? defaultInterpolation,
		keyframeId,
	});

	return (
		setChannel({
			animations,
			propertyPath,
			channel: updatedChannel,
		}) ?? { channels: {} }
	);
}

export function removeElementKeyframe({
	animations,
	propertyPath,
	keyframeId,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
}): ElementAnimations | undefined {
	const channel = getChannel({ animations, propertyPath });
	const updatedChannel = removeKeyframe({
		channel,
		keyframeId,
	});
	return setChannel({
		animations,
		propertyPath,
		channel: updatedChannel,
	});
}

export function retimeElementKeyframe({
	animations,
	propertyPath,
	keyframeId,
	time,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
	keyframeId: string;
	time: number;
}): ElementAnimations | undefined {
	const channel = getChannel({ animations, propertyPath });
	const updatedChannel = retimeKeyframe({
		channel,
		keyframeId,
		time,
	});
	return setChannel({
		animations,
		propertyPath,
		channel: updatedChannel,
	});
}
