import type { EffectDefinition } from "@/types/effects";

const effectDefinitions = new Map<string, EffectDefinition>();

export function registerEffect({
	definition,
}: {
	definition: EffectDefinition;
}): void {
	effectDefinitions.set(definition.type, definition);
}

export function hasEffect({ effectType }: { effectType: string }): boolean {
	return effectDefinitions.has(effectType);
}

export function getEffect({
	effectType,
}: {
	effectType: string;
}): EffectDefinition {
	const definition = effectDefinitions.get(effectType);
	if (!definition) {
		throw new Error(`Unknown effect type: ${effectType}`);
	}
	return definition;
}

export function getAllEffects(): EffectDefinition[] {
	return Array.from(effectDefinitions.values());
}
