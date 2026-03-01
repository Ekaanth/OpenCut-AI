import { DEFAULT_TEXT_BACKGROUND } from "@/constants/text-constants";
import type { TextElement } from "@/types/timeline";

type TextRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export interface TextBlockMeasurement {
	visualCenterOffset: number;
	height: number;
	maxWidth: number;
}

export function getMetricAscent({
	metrics,
	fallbackFontSize,
}: {
	metrics: TextMetrics;
	fallbackFontSize: number;
}): number {
	return metrics.actualBoundingBoxAscent ?? fallbackFontSize * 0.8;
}

export function getMetricDescent({
	metrics,
	fallbackFontSize,
}: {
	metrics: TextMetrics;
	fallbackFontSize: number;
}): number {
	return metrics.actualBoundingBoxDescent ?? fallbackFontSize * 0.2;
}

export function measureTextBlock({
	lineMetrics,
	lineHeightPx,
	fallbackFontSize,
}: {
	lineMetrics: TextMetrics[];
	lineHeightPx: number;
	fallbackFontSize: number;
}): TextBlockMeasurement {
	let top = Number.POSITIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	let maxWidth = 0;

	for (let index = 0; index < lineMetrics.length; index++) {
		const metrics = lineMetrics[index];
		const lineY = index * lineHeightPx;
		top = Math.min(
			top,
			lineY - getMetricAscent({ metrics, fallbackFontSize }),
		);
		bottom = Math.max(
			bottom,
			lineY + getMetricDescent({ metrics, fallbackFontSize }),
		);
		maxWidth = Math.max(maxWidth, metrics.width);
	}

	const height = bottom - top;
	const visualCenterOffset = (top + bottom) / 2;

	return { visualCenterOffset, height, maxWidth };
}

function getTextRect({
	textAlign,
	block,
}: {
	textAlign: TextElement["textAlign"];
	block: TextBlockMeasurement;
}): TextRect {
	const left =
		textAlign === "left" ? 0 : textAlign === "right" ? -block.maxWidth : -block.maxWidth / 2;

	return {
		left,
		top: -block.height / 2,
		width: block.maxWidth,
		height: block.height,
	};
}

function isTextBackgroundVisible({
	background,
}: {
	background: TextElement["background"];
}): boolean {
	return Boolean(background.color) && background.color !== "transparent";
}

export function getTextBackgroundRect({
	textAlign,
	block,
	background,
	fontSizeRatio = 1,
}: {
	textAlign: TextElement["textAlign"];
	block: TextBlockMeasurement;
	background: TextElement["background"];
	fontSizeRatio?: number;
}): TextRect | null {
	if (!isTextBackgroundVisible({ background })) {
		return null;
	}

	const textRect = getTextRect({ textAlign, block });
	const paddingX =
		(background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX) * fontSizeRatio;
	const paddingY =
		(background.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY) * fontSizeRatio;
	const offsetX = background.offsetX ?? DEFAULT_TEXT_BACKGROUND.offsetX;
	const offsetY = background.offsetY ?? DEFAULT_TEXT_BACKGROUND.offsetY;

	return {
		left: textRect.left - paddingX + offsetX,
		top: textRect.top - paddingY + offsetY,
		width: textRect.width + paddingX * 2,
		height: textRect.height + paddingY * 2,
	};
}

export function getTextVisualRect({
	textAlign,
	block,
	background,
	fontSizeRatio = 1,
}: {
	textAlign: TextElement["textAlign"];
	block: TextBlockMeasurement;
	background: TextElement["background"];
	fontSizeRatio?: number;
}): TextRect {
	const textRect = getTextRect({ textAlign, block });
	const backgroundRect = getTextBackgroundRect({
		textAlign,
		block,
		background,
		fontSizeRatio,
	});

	if (!backgroundRect) {
		return textRect;
	}

	const left = Math.min(textRect.left, backgroundRect.left);
	const top = Math.min(textRect.top, backgroundRect.top);
	const right = Math.max(
		textRect.left + textRect.width,
		backgroundRect.left + backgroundRect.width,
	);
	const bottom = Math.max(
		textRect.top + textRect.height,
		backgroundRect.top + backgroundRect.height,
	);

	return {
		left,
		top,
		width: right - left,
		height: bottom - top,
	};
}
