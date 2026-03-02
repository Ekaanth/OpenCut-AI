import type { KeybindingConfig } from "@/types/keybinding";

interface V4State {
	keybindings: KeybindingConfig;
	isCustomized: boolean;
}

export function v4ToV5({ state }: { state: unknown }): unknown {
	const v4 = state as V4State;
	const keybindings = { ...v4.keybindings };

	if (!keybindings.escape) {
		keybindings.escape = "deselect-all";
	}

	return { ...v4, keybindings };
}
