import { hasEffect, registerEffect } from "../registry";
import { blurEffectDefinition } from "./blur";
import { colorAdjustEffectDefinition } from "./color-adjust";
import { sharpenEffectDefinition } from "./sharpen";
import { chromaticAberrationEffectDefinition } from "./chromatic-aberration";
import { vignetteEffectDefinition } from "./vignette";
import { filmGrainEffectDefinition } from "./film-grain";
import { glitchEffectDefinition } from "./glitch";
import { rgbSplitEffectDefinition } from "./rgb-split";
import { lensDistortionEffectDefinition } from "./lens-distortion";
import { motionBlurEffectDefinition } from "./motion-blur";
import { posterizeEffectDefinition } from "./posterize";
import { duotoneEffectDefinition } from "./duotone";
import { chromaKeyEffectDefinition } from "./chroma-key";

const defaultEffects = [
	blurEffectDefinition,
	colorAdjustEffectDefinition,
	sharpenEffectDefinition,
	chromaticAberrationEffectDefinition,
	vignetteEffectDefinition,
	filmGrainEffectDefinition,
	glitchEffectDefinition,
	rgbSplitEffectDefinition,
	lensDistortionEffectDefinition,
	motionBlurEffectDefinition,
	posterizeEffectDefinition,
	duotoneEffectDefinition,
	chromaKeyEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}
