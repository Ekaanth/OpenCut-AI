import type { TransitionDefinition } from "./registry";
import { registerTransition } from "./registry";
import crossDissolveShader from "./shaders/cross-dissolve.frag.glsl";
import dipBlackShader from "./shaders/dip-black.frag.glsl";
import slideLeftShader from "./shaders/slide-left.frag.glsl";
import slideRightShader from "./shaders/slide-right.frag.glsl";
import wipeLeftShader from "./shaders/wipe-left.frag.glsl";
import wipeRightShader from "./shaders/wipe-right.frag.glsl";
import zoomShader from "./shaders/zoom.frag.glsl";
import irisWipeShader from "./shaders/iris-wipe.frag.glsl";
import clockWipeShader from "./shaders/clock-wipe.frag.glsl";
import morphShader from "./shaders/morph.frag.glsl";
import glitchShader from "./shaders/glitch.frag.glsl";
import filmBurnShader from "./shaders/film-burn.frag.glsl";
import pagePeelShader from "./shaders/page-peel.frag.glsl";
import spinShader from "./shaders/spin.frag.glsl";
import pushShader from "./shaders/push.frag.glsl";
import fadeWhiteShader from "./shaders/fade-white.frag.glsl";
import checkerboardShader from "./shaders/checkerboard.frag.glsl";
import dissolveZoomShader from "./shaders/dissolve-zoom.frag.glsl";
import bandSlideShader from "./shaders/band-slide.frag.glsl";
import cubeSpinShader from "./shaders/cube-spin.frag.glsl";

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
	{
		type: "iris-wipe",
		name: "Iris Wipe",
		category: "iris",
		keywords: ["iris", "circle", "reveal", "aperture", "star wipe"],
		defaultDuration: 0.6,
		fragmentShader: irisWipeShader,
	},
	{
		type: "clock-wipe",
		name: "Clock Wipe",
		category: "wipe",
		keywords: ["clock", "radial", "sweep", "angle"],
		defaultDuration: 0.6,
		fragmentShader: clockWipeShader,
	},
	{
		type: "morph",
		name: "Morph",
		category: "morph",
		keywords: ["morph", "distort", "transform", "warp"],
		defaultDuration: 0.75,
		fragmentShader: morphShader,
	},
	{
		type: "glitch",
		name: "Glitch",
		category: "distortion",
		keywords: ["glitch", "digital", "error", "corrupt", "pixel"],
		defaultDuration: 0.5,
		fragmentShader: glitchShader,
	},
	{
		type: "film-burn",
		name: "Film Burn",
		category: "burn",
		keywords: ["burn", "light", "leak", "film", "fire", "heat"],
		defaultDuration: 0.8,
		fragmentShader: filmBurnShader,
	},
	{
		type: "page-peel",
		name: "Page Peel",
		category: "peel",
		keywords: ["page", "peel", "turn", "curl", "book"],
		defaultDuration: 0.8,
		fragmentShader: pagePeelShader,
	},
	{
		type: "spin",
		name: "Spin",
		category: "spin",
		keywords: ["spin", "rotate", "turn", "whirl"],
		defaultDuration: 0.75,
		fragmentShader: spinShader,
	},
	{
		type: "push",
		name: "Push",
		category: "slide",
		keywords: ["push", "shove", "slide", "move"],
		defaultDuration: 0.5,
		fragmentShader: pushShader,
	},
	{
		type: "fade-white",
		name: "Fade Through White",
		category: "dip",
		keywords: ["white", "fade", "bright", "light", "flash"],
		defaultDuration: 0.6,
		fragmentShader: fadeWhiteShader,
	},
	{
		type: "checkerboard",
		name: "Checkerboard",
		category: "pattern",
		keywords: ["checker", "grid", "pattern", "tiles", "blocks"],
		defaultDuration: 0.5,
		fragmentShader: checkerboardShader,
	},
	{
		type: "dissolve-zoom",
		name: "Dissolve with Zoom",
		category: "dissolve",
		keywords: ["dissolve", "zoom", "scale", "blend"],
		defaultDuration: 0.75,
		fragmentShader: dissolveZoomShader,
	},
	{
		type: "band-slide",
		name: "Band Slide",
		category: "slide",
		keywords: ["band", "strip", "slide", "multi", "horizontal"],
		defaultDuration: 0.6,
		fragmentShader: bandSlideShader,
	},
	{
		type: "cube-spin",
		name: "Cube Spin",
		category: "cube",
		keywords: ["cube", "3d", "spin", "rotate", "perspective"],
		defaultDuration: 0.75,
		fragmentShader: cubeSpinShader,
	},
];

export function registerDefaultTransitions(): void {
	for (const definition of BUILTIN_TRANSITIONS) {
		registerTransition({ definition });
	}
}
