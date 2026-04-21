import type { TransitionDefinition } from "./registry";
import { registerTransition } from "./registry";
import crossDissolveShader from "./shaders/cross-dissolve.frag.glsl";
import dipBlackShader from "./shaders/dip-black.frag.glsl";
import slideLeftShader from "./shaders/slide-left.frag.glsl";
import slideRightShader from "./shaders/slide-right.frag.glsl";
import wipeLeftShader from "./shaders/wipe-left.frag.glsl";
import wipeRightShader from "./shaders/wipe-right.frag.glsl";
import zoomShader from "./shaders/zoom.frag.glsl";

const BUILTIN_TRANSITIONS: TransitionDefinition[] = [
	{
		type: "cross-dissolve",
		name: "Cross Dissolve",
		category: "dissolve",
		keywords: ["crossfade", "dissolve", "fade", "blend", "opacity"],
		defaultDuration: 0.5,
		fragmentShader: crossDissolveShader,
	},
	{
		type: "dip-black",
		name: "Dip to Black",
		category: "dip",
		keywords: ["black", "fade", "dark", "dip"],
		defaultDuration: 0.75,
		fragmentShader: dipBlackShader,
	},
	{
		type: "slide-left",
		name: "Slide Left",
		category: "slide",
		keywords: ["slide", "push", "left", "horizontal"],
		defaultDuration: 0.5,
		fragmentShader: slideLeftShader,
	},
	{
		type: "slide-right",
		name: "Slide Right",
		category: "slide",
		keywords: ["slide", "push", "right", "horizontal"],
		defaultDuration: 0.5,
		fragmentShader: slideRightShader,
	},
	{
		type: "wipe-left",
		name: "Wipe Left",
		category: "wipe",
		keywords: ["wipe", "reveal", "left", "edge"],
		defaultDuration: 0.5,
		fragmentShader: wipeLeftShader,
	},
	{
		type: "wipe-right",
		name: "Wipe Right",
		category: "wipe",
		keywords: ["wipe", "reveal", "right", "edge"],
		defaultDuration: 0.5,
		fragmentShader: wipeRightShader,
	},
	{
		type: "zoom",
		name: "Zoom",
		category: "zoom",
		keywords: ["zoom", "scale", "magnify", "grow"],
		defaultDuration: 0.75,
		fragmentShader: zoomShader,
	},
];

export function registerDefaultTransitions(): void {
	for (const definition of BUILTIN_TRANSITIONS) {
		registerTransition({ definition });
	}
}
