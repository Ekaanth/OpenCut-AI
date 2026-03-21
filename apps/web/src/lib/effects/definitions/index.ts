import { hasEffect, registerEffect } from "../registry";
import { blurEffectDefinition } from "./blur";
import { colorAdjustEffectDefinition } from "./color-adjust";

const defaultEffects = [blurEffectDefinition, colorAdjustEffectDefinition];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}
