import { generateUUID } from "@/utils/id";
import { getEffect } from "./registry";
import type { Effect, EffectParamValues } from "@/types/effects";
import type { VisualElement } from "@/types/timeline";

export { getEffect, getAllEffects, hasEffect, registerEffect } from "./registry";
export { registerDefaultEffects } from "./definitions";

export const EFFECT_TARGET_ELEMENT_TYPES: VisualElement["type"][] = [
	"video",
	"image",
	"text",
	"sticker",
];

export function buildDefaultEffectInstance({
	effectType,
}: {
	effectType: string;
}): Effect {
	const definition = getEffect({ effectType });

	const params: EffectParamValues = {};
	for (const paramDef of definition.params) {
		params[paramDef.key] = paramDef.default;
	}

	return {
		id: generateUUID(),
		type: effectType,
		params,
		enabled: true,
	};
}
