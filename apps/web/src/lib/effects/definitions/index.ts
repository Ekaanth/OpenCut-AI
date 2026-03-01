import { hasEffect, registerEffect } from "../registry";
import { blurEffectDefinition } from "./blur";

const defaultEffects = [blurEffectDefinition];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}
