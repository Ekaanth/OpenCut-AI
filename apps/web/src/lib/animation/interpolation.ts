import type {
	AnimationChannel,
	AnimationValue,
	ColorAnimationChannel,
	DiscreteValue,
	DiscreteAnimationChannel,
	NumberAnimationChannel,
} from "@/types/animation";
import { TIME_EPSILON_SECONDS } from "@/constants/animation-constants";

function byTimeAscending({
	leftTime,
	rightTime,
}: {
	leftTime: number;
	rightTime: number;
}): number {
	return leftTime - rightTime;
}

function isWithinTimePair({
	time,
	leftTime,
	rightTime,
}: {
	time: number;
	leftTime: number;
	rightTime: number;
}): boolean {
	return (
		time >= leftTime - TIME_EPSILON_SECONDS &&
		time <= rightTime + TIME_EPSILON_SECONDS
	);
}

function clamp01({ value }: { value: number }): number {
	return Math.max(0, Math.min(1, value));
}

function parseHexChannel({ hex }: { hex: string }): number | null {
	const value = Number.parseInt(hex, 16);
	return Number.isNaN(value) ? null : value;
}

function parseHexColor({
	color,
}: {
	color: string;
}): { red: number; green: number; blue: number; alpha: number } | null {
	const trimmed = color.trim();
	if (!trimmed.startsWith("#")) {
		return null;
	}

	const rawHex = trimmed.slice(1);
	if (rawHex.length === 3 || rawHex.length === 4) {
		const [redHex, greenHex, blueHex, alphaHex = "f"] = rawHex.split("");
		const red = parseHexChannel({ hex: `${redHex}${redHex}` });
		const green = parseHexChannel({ hex: `${greenHex}${greenHex}` });
		const blue = parseHexChannel({ hex: `${blueHex}${blueHex}` });
		const alpha = parseHexChannel({ hex: `${alphaHex}${alphaHex}` });
		if (
			red === null ||
			green === null ||
			blue === null ||
			alpha === null
		) {
			return null;
		}

		return { red, green, blue, alpha: alpha / 255 };
	}

	if (rawHex.length === 6 || rawHex.length === 8) {
		const red = parseHexChannel({ hex: rawHex.slice(0, 2) });
		const green = parseHexChannel({ hex: rawHex.slice(2, 4) });
		const blue = parseHexChannel({ hex: rawHex.slice(4, 6) });
		const alphaHex = rawHex.length === 8 ? rawHex.slice(6, 8) : "ff";
		const alpha = parseHexChannel({ hex: alphaHex });
		if (
			red === null ||
			green === null ||
			blue === null ||
			alpha === null
		) {
			return null;
		}

		return { red, green, blue, alpha: alpha / 255 };
	}

	return null;
}

function formatRgbaColor({
	red,
	green,
	blue,
	alpha,
}: {
	red: number;
	green: number;
	blue: number;
	alpha: number;
}): string {
	const roundedRed = Math.round(red);
	const roundedGreen = Math.round(green);
	const roundedBlue = Math.round(blue);
	const roundedAlpha = Math.round(clamp01({ value: alpha }) * 1000) / 1000;
	return `rgba(${roundedRed}, ${roundedGreen}, ${roundedBlue}, ${roundedAlpha})`;
}

function lerpNumber({
	leftValue,
	rightValue,
	progress,
}: {
	leftValue: number;
	rightValue: number;
	progress: number;
}): number {
	return leftValue + (rightValue - leftValue) * progress;
}

function interpolateColor({
	leftColor,
	rightColor,
	progress,
}: {
	leftColor: string;
	rightColor: string;
	progress: number;
}): string {
	const leftParsed = parseHexColor({ color: leftColor });
	const rightParsed = parseHexColor({ color: rightColor });
	if (!leftParsed || !rightParsed) {
		return progress >= 1 ? rightColor : leftColor;
	}

	return formatRgbaColor({
		red: lerpNumber({
			leftValue: leftParsed.red,
			rightValue: rightParsed.red,
			progress,
		}),
		green: lerpNumber({
			leftValue: leftParsed.green,
			rightValue: rightParsed.green,
			progress,
		}),
		blue: lerpNumber({
			leftValue: leftParsed.blue,
			rightValue: rightParsed.blue,
			progress,
		}),
		alpha: lerpNumber({
			leftValue: leftParsed.alpha,
			rightValue: rightParsed.alpha,
			progress,
		}),
	});
}

export function normalizeChannel<TChannel extends AnimationChannel>({
	channel,
}: {
	channel: TChannel;
}): TChannel {
	return {
		...channel,
		keyframes: [...channel.keyframes].sort((leftKeyframe, rightKeyframe) =>
			byTimeAscending({
				leftTime: leftKeyframe.time,
				rightTime: rightKeyframe.time,
			}),
		),
	} as TChannel;
}

function evaluateChannelValueAtTime<TKeyframe extends { time: number; value: TValue }, TValue>({
	keyframes,
	time,
	fallbackValue,
	getInterpolatedValue,
}: {
	keyframes: TKeyframe[] | undefined;
	time: number;
	fallbackValue: TValue;
	getInterpolatedValue: ({
		leftKeyframe,
		rightKeyframe,
		progress,
	}: {
		leftKeyframe: TKeyframe;
		rightKeyframe: TKeyframe;
		progress: number;
	}) => TValue;
}): TValue {
	if (!keyframes || keyframes.length === 0) {
		return fallbackValue;
	}

	const firstKeyframe = keyframes[0];
	const lastKeyframe = keyframes[keyframes.length - 1];
	if (!firstKeyframe || !lastKeyframe) {
		return fallbackValue;
	}

	if (time <= firstKeyframe.time + TIME_EPSILON_SECONDS) {
		return firstKeyframe.value;
	}

	if (time >= lastKeyframe.time - TIME_EPSILON_SECONDS) {
		return lastKeyframe.value;
	}

	for (let keyframeIndex = 0; keyframeIndex < keyframes.length - 1; keyframeIndex++) {
		const leftKeyframe = keyframes[keyframeIndex];
		const rightKeyframe = keyframes[keyframeIndex + 1];

		if (Math.abs(time - rightKeyframe.time) <= TIME_EPSILON_SECONDS) {
			return rightKeyframe.value;
		}

		const isBetweenPair = isWithinTimePair({
			time,
			leftTime: leftKeyframe.time,
			rightTime: rightKeyframe.time,
		});
		if (!isBetweenPair) {
			continue;
		}

		const span = rightKeyframe.time - leftKeyframe.time;
		if (Math.abs(span) <= TIME_EPSILON_SECONDS) {
			return rightKeyframe.value;
		}

		const progress = clamp01({
			value: (time - leftKeyframe.time) / span,
		});

		return getInterpolatedValue({
			leftKeyframe,
			rightKeyframe,
			progress,
		});
	}

	return lastKeyframe.value;
}

export function getNumberChannelValueAtTime({
	channel,
	time,
	fallbackValue,
}: {
	channel: NumberAnimationChannel | undefined;
	time: number;
	fallbackValue: number;
}): number {
	return evaluateChannelValueAtTime({
		keyframes: channel?.keyframes,
		time,
		fallbackValue,
		getInterpolatedValue: ({ leftKeyframe, rightKeyframe, progress }) => {
			if (leftKeyframe.interpolation === "hold") {
				return leftKeyframe.value;
			}

			return lerpNumber({
				leftValue: leftKeyframe.value,
				rightValue: rightKeyframe.value,
				progress,
			});
		},
	});
}

function getColorValueAtTime({
	channel,
	time,
	fallbackValue,
}: {
	channel: ColorAnimationChannel | undefined;
	time: number;
	fallbackValue: string;
}): string {
	return evaluateChannelValueAtTime({
		keyframes: channel?.keyframes,
		time,
		fallbackValue,
		getInterpolatedValue: ({ leftKeyframe, rightKeyframe, progress }) => {
			if (leftKeyframe.interpolation === "hold") {
				return leftKeyframe.value;
			}

			return interpolateColor({
				leftColor: leftKeyframe.value,
				rightColor: rightKeyframe.value,
				progress,
			});
		},
	});
}

function getDiscreteValueAtTime({
	channel,
	time,
	fallbackValue,
}: {
	channel: DiscreteAnimationChannel | undefined;
	time: number;
	fallbackValue: DiscreteValue;
}): DiscreteValue {
	return evaluateChannelValueAtTime({
		keyframes: channel?.keyframes,
		time,
		fallbackValue,
		getInterpolatedValue: ({ leftKeyframe }) => leftKeyframe.value,
	});
}

export function getChannelValueAtTime({
	channel,
	time,
	fallbackValue,
}: {
	channel: AnimationChannel | undefined;
	time: number;
	fallbackValue: AnimationValue;
}): AnimationValue {
	if (!channel || channel.keyframes.length === 0) {
		return fallbackValue;
	}

	if (channel.valueKind === "number") {
		if (typeof fallbackValue !== "number") {
			return fallbackValue;
		}

		return getNumberChannelValueAtTime({
			channel,
			time,
			fallbackValue,
		});
	}

	if (channel.valueKind === "color") {
		if (typeof fallbackValue !== "string") {
			return fallbackValue;
		}

		return getColorValueAtTime({
			channel,
			time,
			fallbackValue,
		});
	}

	if (typeof fallbackValue !== "string" && typeof fallbackValue !== "boolean") {
		return fallbackValue;
	}

	return getDiscreteValueAtTime({
		channel,
		time,
		fallbackValue,
	});
}
