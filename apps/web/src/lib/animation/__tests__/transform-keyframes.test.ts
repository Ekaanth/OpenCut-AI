import { describe, expect, test } from "bun:test";
import type { ElementAnimations } from "@/types/animation";
import {
	clampAnimationsToDuration,
	getElementKeyframes,
	getKeyframeAtTime,
	hasKeyframesForPath,
	getChannelValueAtTime,
	getElementLocalTime,
	resolveTransformAtTime,
	splitAnimationsAtTime,
} from "@/lib/animation";

describe("transform keyframe evaluation", () => {
	test("uses fallback value when channel is missing", () => {
		const value = getChannelValueAtTime({
			channel: undefined,
			time: 1,
			fallbackValue: 42,
		});
		expect(value).toBe(42);
	});

	test("returns boundary value when time is within epsilon of first/last keyframe", () => {
		const channel = {
			valueKind: "number" as const,
			keyframes: [
				{ id: "a", time: 0, value: 10, interpolation: "linear" as const },
				{ id: "b", time: 2, value: 30, interpolation: "linear" as const },
			],
		};
		expect(
			getChannelValueAtTime({
				channel,
				time: 0.0008,
				fallbackValue: 0,
			}),
		).toBe(10);
		expect(
			getChannelValueAtTime({
				channel,
				time: 1.9992,
				fallbackValue: 0,
			}),
		).toBe(30);
	});

	test("interpolates linear channels", () => {
		const value = getChannelValueAtTime({
			channel: {
				valueKind: "number",
				keyframes: [
					{ id: "a", time: 0, value: 10, interpolation: "linear" },
					{ id: "b", time: 2, value: 30, interpolation: "linear" },
				],
			},
			time: 1,
			fallbackValue: 0,
		});
		expect(value).toBe(20);
	});

	test("clamps local time to [0, duration]", () => {
		expect(
			getElementLocalTime({
				timelineTime: 2,
				elementStartTime: 5,
				elementDuration: 4,
			}),
		).toBe(0);
		expect(
			getElementLocalTime({
				timelineTime: 12,
				elementStartTime: 5,
				elementDuration: 4,
			}),
		).toBe(4);
		expect(
			getElementLocalTime({
				timelineTime: 7,
				elementStartTime: 5,
				elementDuration: 4,
			}),
		).toBe(2);
	});

	test("uses hold interpolation from the left keyframe", () => {
		const value = getChannelValueAtTime({
			channel: {
				valueKind: "number",
				keyframes: [
					{ id: "a", time: 0, value: 10, interpolation: "hold" },
					{ id: "b", time: 2, value: 30, interpolation: "linear" },
				],
			},
			time: 1,
			fallbackValue: 0,
		});
		expect(value).toBe(10);
	});

	test("resolves transform by mixing animated and fallback properties", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.position.x": {
					valueKind: "number",
					keyframes: [
						{ id: "a", time: 0, value: 0, interpolation: "linear" },
						{ id: "b", time: 4, value: 80, interpolation: "linear" },
					],
				},
				"transform.scale": {
					valueKind: "number",
					keyframes: [{ id: "c", time: 0, value: 2, interpolation: "hold" }],
				},
			},
		};
		const resolvedTransform = resolveTransformAtTime({
			baseTransform: {
				position: { x: 10, y: 20 },
				scale: 1,
				rotate: 15,
			},
			animations,
			localTime: 2,
		});
		expect(resolvedTransform).toEqual({
			position: { x: 40, y: 20 },
			scale: 2,
			rotate: 15,
		});
	});
});

describe("transform keyframe mutation utilities", () => {
	test("splits channels and rebases right side times", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.scale": {
					valueKind: "number",
					keyframes: [
						{ id: "a", time: 0, value: 1, interpolation: "linear" },
						{ id: "b", time: 2, value: 2, interpolation: "linear" },
						{ id: "c", time: 6, value: 4, interpolation: "linear" },
					],
				},
			},
		};
		const { leftAnimations, rightAnimations } = splitAnimationsAtTime({
			animations,
			splitTime: 4,
		});

		expect(
			leftAnimations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 2, 4]);
		expect(
			rightAnimations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 2]);
		expect(
			rightAnimations?.channels["transform.scale"]?.keyframes[0]?.value,
		).toBe(3);
	});

	test("clamps channels to updated element duration", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.rotate": {
					valueKind: "number",
					keyframes: [
						{ id: "a", time: 0, value: 0, interpolation: "linear" },
						{ id: "b", time: 2, value: 20, interpolation: "linear" },
						{ id: "c", time: 5, value: 50, interpolation: "linear" },
					],
				},
			},
		};
		const clampedAnimations = clampAnimationsToDuration({
			animations,
			duration: 2,
		});
		expect(
			clampedAnimations?.channels["transform.rotate"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 2]);
	});
});

describe("typed channel interpolation", () => {
	test("interpolates color channels from hex keyframes", () => {
		const value = getChannelValueAtTime({
			channel: {
				valueKind: "color",
				keyframes: [
					{ id: "a", time: 0, value: "#000000", interpolation: "linear" },
					{ id: "b", time: 1, value: "#ffffff", interpolation: "linear" },
				],
			},
			time: 0.5,
			fallbackValue: "#000000",
		});
		expect(typeof value).toBe("string");
		expect(value).toContain("rgba(");
	});

	test("uses hold behavior for discrete channels", () => {
		const value = getChannelValueAtTime({
			channel: {
				valueKind: "discrete",
				keyframes: [
					{ id: "a", time: 0, value: "normal", interpolation: "hold" },
					{ id: "b", time: 2, value: "multiply", interpolation: "hold" },
				],
			},
			time: 1.2,
			fallbackValue: "normal",
		});
		expect(value).toBe("normal");
	});
});

describe("keyframe query helpers", () => {
	test("getElementKeyframes returns flat list of all keyframes across channels", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.position.x": {
					valueKind: "number",
					keyframes: [{ id: "x-1", time: 1, value: 64, interpolation: "linear" }],
				},
				opacity: {
					valueKind: "number",
					keyframes: [{ id: "o-1", time: 0, value: 1, interpolation: "linear" }],
				},
			},
		};

		const keyframes = getElementKeyframes({ animations });
		expect(keyframes).toHaveLength(2);
		expect(keyframes.map((keyframe) => keyframe.propertyPath).sort()).toEqual([
			"opacity",
			"transform.position.x",
		]);
	});

	test("getElementKeyframes returns empty array when animations are missing or channels are empty", () => {
		expect(getElementKeyframes({ animations: undefined })).toEqual([]);
		expect(
			getElementKeyframes({
				animations: {
					channels: { opacity: { valueKind: "number", keyframes: [] } },
				},
			}),
		).toEqual([]);
	});

	test("hasKeyframesForPath returns true only for paths with keyframes", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.position.x": {
					valueKind: "number",
					keyframes: [{ id: "x-1", time: 1, value: 64, interpolation: "linear" }],
				},
				"transform.position.y": {
					valueKind: "number",
					keyframes: [],
				},
			},
		};

		expect(
			hasKeyframesForPath({ animations, propertyPath: "transform.position.x" }),
		).toBe(true);
		expect(
			hasKeyframesForPath({ animations, propertyPath: "transform.position.y" }),
		).toBe(false);
	});

	test("getKeyframeAtTime finds keyframe within epsilon and returns full object", () => {
		const animations: ElementAnimations = {
			channels: {
				"transform.rotate": {
					valueKind: "number",
					keyframes: [
						{ id: "r-1", time: 1, value: 15, interpolation: "linear" },
						{ id: "r-2", time: 2, value: 30, interpolation: "linear" },
					],
				},
			},
		};

		const found = getKeyframeAtTime({
			animations,
			propertyPath: "transform.rotate",
			time: 1.0008,
		});
		expect(found?.id).toBe("r-1");
		expect(found?.value).toBe(15);
		expect(found?.propertyPath).toBe("transform.rotate");

		expect(
			getKeyframeAtTime({
				animations,
				propertyPath: "transform.rotate",
				time: 1.01,
			}),
		).toBeNull();
	});
});
