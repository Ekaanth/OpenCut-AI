import type { Effect, EffectParamValues } from "@/types/effects";
import type {
	ElementAnimations,
	NumberAnimationChannel,
} from "@/types/animation";
import {
	getChannel,
	removeKeyframe,
	setChannel,
	upsertKeyframe,
} from "./keyframes";
import { getChannelValueAtTime } from "./interpolation";

const EFFECT_PARAM_PATH_PREFIX = "effects.";
const EFFECT_PARAM_PATH_SUFFIX = ".params.";

function buildEffectParamPath({
	effectId,
	paramKey,
}: {
	effectId: string;
	paramKey: string;
}): string {
	return `${EFFECT_PARAM_PATH_PREFIX}${effectId}${EFFECT_PARAM_PATH_SUFFIX}${paramKey}`;
}

export function resolveEffectParamsAtTime({
	effect,
	animations,
	localTime,
}: {
	effect: Effect;
	animations: ElementAnimations | undefined;
	localTime: number;
}): EffectParamValues {
	const resolved: EffectParamValues = {};

	for (const [paramKey, staticValue] of Object.entries(effect.params)) {
		const path = buildEffectParamPath({ effectId: effect.id, paramKey });
		const channel = getChannel({ animations, propertyPath: path });
		if (channel && channel.keyframes.length > 0) {
			resolved[paramKey] = getChannelValueAtTime({
				channel,
				time: localTime,
				fallbackValue: staticValue,
			}) as number | string | boolean;
		} else {
			resolved[paramKey] = staticValue;
		}
	}

	return resolved;
}

const EMPTY_NUMBER_CHANNEL: NumberAnimationChannel = {
	valueKind: "number",
	keyframes: [],
};

export function upsertEffectParamKeyframe({
	animations,
	effectId,
	paramKey,
	time,
	value,
	interpolation,
	keyframeId,
}: {
	animations: ElementAnimations | undefined;
	effectId: string;
	paramKey: string;
	time: number;
	value: number;
	interpolation?: "linear" | "hold";
	keyframeId?: string;
}): ElementAnimations | undefined {
	const path = buildEffectParamPath({ effectId, paramKey });
	const channel = getChannel({ animations, propertyPath: path });
	const targetChannel =
		channel && channel.valueKind === "number" ? channel : EMPTY_NUMBER_CHANNEL;
	const updatedChannel = upsertKeyframe({
		channel: targetChannel,
		time,
		value,
		interpolation: interpolation ?? "linear",
		keyframeId,
	});

	return (
		setChannel({
			animations,
			propertyPath: path,
			channel: updatedChannel,
		}) ?? { channels: {} }
	);
}

export function removeEffectParamKeyframe({
	animations,
	effectId,
	paramKey,
	keyframeId,
}: {
	animations: ElementAnimations | undefined;
	effectId: string;
	paramKey: string;
	keyframeId: string;
}): ElementAnimations | undefined {
	const path = buildEffectParamPath({ effectId, paramKey });
	const channel = getChannel({ animations, propertyPath: path });
	const updatedChannel = removeKeyframe({ channel, keyframeId });
	return setChannel({
		animations,
		propertyPath: path,
		channel: updatedChannel,
	});
}
