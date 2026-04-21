export interface TransitionDefinition {
	type: string;
	name: string;
	category: "dissolve" | "slide" | "wipe" | "zoom" | "dip";
	keywords: string[];
	defaultDuration: number;
	fragmentShader: string;
}

const transitionDefinitions = new Map<string, TransitionDefinition>();

export function registerTransition({
	definition,
}: {
	definition: TransitionDefinition;
}): void {
	transitionDefinitions.set(definition.type, definition);
}

export function getTransition({
	transitionType,
}: {
	transitionType: string;
}): TransitionDefinition {
	const def = transitionDefinitions.get(transitionType);
	if (!def) throw new Error(`Unknown transition type: ${transitionType}`);
	return def;
}

export function getAllTransitions(): TransitionDefinition[] {
	return Array.from(transitionDefinitions.values());
}

export function hasTransition({
	transitionType,
}: {
	transitionType: string;
}): boolean {
	return transitionDefinitions.has(transitionType);
}
