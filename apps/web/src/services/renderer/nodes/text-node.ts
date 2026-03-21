import type { CanvasRenderer } from "../canvas-renderer";
import { createOffscreenCanvas } from "../canvas-utils";
import { BaseNode } from "./base-node";
import type { TextElement, TextWordTiming } from "@/types/timeline";
import { useTranscriptStore } from "@/stores/transcript-store";
import {
	DEFAULT_TEXT_BACKGROUND,
	DEFAULT_TEXT_ELEMENT,
	DEFAULT_LINE_HEIGHT,
	FONT_SIZE_SCALE_REFERENCE,
	CORNER_RADIUS_MAX,
	CORNER_RADIUS_MIN,
} from "@/constants/text-constants";
import {
	getMetricAscent,
	getMetricDescent,
	getTextBackgroundRect,
	measureTextBlock,
} from "@/lib/text/layout";
import {
	getElementLocalTime,
	resolveColorAtTime,
	resolveNumberAtTime,
	resolveOpacityAtTime,
	resolveTransformAtTime,
} from "@/lib/animation";
import { resolveEffectParamsAtTime } from "@/lib/animation/effect-param-channel";
import { getEffect } from "@/lib/effects";
import { webglEffectRenderer } from "../webgl-effect-renderer";
import { clamp } from "@/utils/math";

function scaleFontSize({
	fontSize,
	canvasHeight,
}: {
	fontSize: number;
	canvasHeight: number;
}): number {
	return fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
}

function quoteFontFamily({ fontFamily }: { fontFamily: string }): string {
	return `"${fontFamily.replace(/"/g, '\\"')}"`;
}

const TEXT_DECORATION_THICKNESS_RATIO = 0.07;
const STRIKETHROUGH_VERTICAL_RATIO = 0.35;
const SUBTITLE_WRAP_PADDING_RATIO = 0.08; // 8% padding on each side

function wrapTextLines({
	lines,
	ctx,
	maxWidth,
}: {
	lines: string[];
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	maxWidth: number;
}): string[] {
	const wrapped: string[] = [];

	for (const line of lines) {
		if (ctx.measureText(line).width <= maxWidth) {
			wrapped.push(line);
			continue;
		}

		const words = line.split(/\s+/);
		let currentLine = "";

		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			if (ctx.measureText(testLine).width <= maxWidth && currentLine) {
				currentLine = testLine;
			} else if (!currentLine) {
				// First word on line — always add it even if it overflows
				currentLine = word;
			} else {
				wrapped.push(currentLine);
				currentLine = word;
			}
		}

		if (currentLine) {
			wrapped.push(currentLine);
		}
	}

	return wrapped;
}

function drawTextDecoration({
	ctx,
	textDecoration,
	lineWidth,
	lineY,
	metrics,
	scaledFontSize,
	textAlign,
}: {
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	textDecoration: string;
	lineWidth: number;
	lineY: number;
	metrics: TextMetrics;
	scaledFontSize: number;
	textAlign: CanvasTextAlign;
}): void {
	if (textDecoration === "none" || !textDecoration) return;

	const thickness = Math.max(1, scaledFontSize * TEXT_DECORATION_THICKNESS_RATIO);
	const ascent = getMetricAscent({ metrics, fallbackFontSize: scaledFontSize });
	const descent = getMetricDescent({ metrics, fallbackFontSize: scaledFontSize });

	let xStart = -lineWidth / 2;
	if (textAlign === "left") xStart = 0;
	if (textAlign === "right") xStart = -lineWidth;

	if (textDecoration === "underline") {
		const underlineY = lineY + descent + thickness;
		ctx.fillRect(xStart, underlineY, lineWidth, thickness);
	}

	if (textDecoration === "line-through") {
		const strikeY = lineY - (ascent - descent) * STRIKETHROUGH_VERTICAL_RATIO;
		ctx.fillRect(xStart, strikeY, lineWidth, thickness);
	}
}

export type TextNodeParams = TextElement & {
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
};

export class TextNode extends BaseNode<TextNodeParams> {
	private drawKaraokeText({
		ctx,
		line,
		lineY,
		localTime,
		wordTimings,
		defaultColor,
		highlightColor,
		textAlign,
	}: {
		ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
		line: string;
		lineY: number;
		localTime: number;
		wordTimings: TextWordTiming[];
		defaultColor: string;
		highlightColor: string;
		textAlign: CanvasTextAlign;
	}): void {
		// Split the line into words preserving spacing
		const words = line.split(/(\s+)/);
		const fullWidth = ctx.measureText(line).width;

		// Compute starting x based on alignment
		let cursorX: number;
		if (textAlign === "center") {
			cursorX = -fullWidth / 2;
		} else if (textAlign === "right") {
			cursorX = -fullWidth;
		} else {
			cursorX = 0;
		}

		// Save alignment and switch to left for manual positioning
		const savedAlign = ctx.textAlign;
		ctx.textAlign = "left";

		let wordIndex = 0;
		for (const token of words) {
			if (token.trim().length === 0) {
				// Whitespace — just advance cursor
				cursorX += ctx.measureText(token).width;
				continue;
			}

			// Match this token to the next word timing
			const timing = wordTimings[wordIndex];
			const isSpoken = timing && localTime >= timing.start;

			ctx.fillStyle = isSpoken ? highlightColor : defaultColor;
			ctx.fillText(token, cursorX, lineY);
			cursorX += ctx.measureText(token).width;
			wordIndex++;
		}

		// Restore alignment
		ctx.textAlign = savedAlign;
		ctx.fillStyle = defaultColor;
	}

	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) {
			return;
		}

		const localTime = getElementLocalTime({
			timelineTime: time,
			elementStartTime: this.params.startTime,
			elementDuration: this.params.duration,
		});
		const transform = resolveTransformAtTime({
			baseTransform: this.params.transform,
			animations: this.params.animations,
			localTime,
		});
		const opacity = resolveOpacityAtTime({
			baseOpacity: this.params.opacity,
			animations: this.params.animations,
			localTime,
		});

		const x = transform.position.x + this.params.canvasCenter.x;
		const y = transform.position.y + this.params.canvasCenter.y;

		const fontWeight = this.params.fontWeight === "bold" ? "bold" : "normal";
		const fontStyle = this.params.fontStyle === "italic" ? "italic" : "normal";
		const scaledFontSize = scaleFontSize({
			fontSize: this.params.fontSize,
			canvasHeight: this.params.canvasHeight,
		});
		const fontFamily = quoteFontFamily({ fontFamily: this.params.fontFamily });
		const fontString = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${fontFamily}, sans-serif`;
		const letterSpacing = this.params.letterSpacing ?? 0;
		const lineHeight = this.params.lineHeight ?? DEFAULT_LINE_HEIGHT;
		const rawLines = this.params.content.split("\n");
		const lineHeightPx = scaledFontSize * lineHeight;
		const fontSizeRatio = this.params.fontSize / DEFAULT_TEXT_ELEMENT.fontSize;
		const baseline = this.params.textBaseline ?? "middle";
		const blendMode = (
			this.params.blendMode && this.params.blendMode !== "normal"
				? this.params.blendMode
				: "source-over"
		) as GlobalCompositeOperation;

	renderer.context.save();
		renderer.context.font = fontString;
		renderer.context.textBaseline = baseline;
		if ("letterSpacing" in renderer.context) {
			(renderer.context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
		}

		// Word-wrap lines that overflow the canvas width
		const maxTextWidth = renderer.width * (1 - SUBTITLE_WRAP_PADDING_RATIO * 2);
		const lines = wrapTextLines({
			lines: rawLines,
			ctx: renderer.context,
			maxWidth: maxTextWidth,
		});

		const lineMetrics = lines.map((line) => renderer.context.measureText(line));
		renderer.context.restore();

		const lineCount = lines.length;
		const block = measureTextBlock({ lineMetrics, lineHeightPx, fallbackFontSize: scaledFontSize });

	const textColor = resolveColorAtTime({
			baseColor: this.params.color,
			animations: this.params.animations,
			propertyPath: "color",
			localTime,
		});
		const bg = this.params.background;
		const resolvedBackground = {
			...bg,
			color: resolveColorAtTime({
				baseColor: bg.color,
				animations: this.params.animations,
				propertyPath: "background.color",
				localTime,
			}),
			paddingX: resolveNumberAtTime({
				baseValue: bg.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
				animations: this.params.animations,
				propertyPath: "background.paddingX",
				localTime,
			}),
			paddingY: resolveNumberAtTime({
				baseValue: bg.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY,
				animations: this.params.animations,
				propertyPath: "background.paddingY",
				localTime,
			}),
			offsetX: resolveNumberAtTime({
				baseValue: bg.offsetX ?? DEFAULT_TEXT_BACKGROUND.offsetX,
				animations: this.params.animations,
				propertyPath: "background.offsetX",
				localTime,
			}),
			offsetY: resolveNumberAtTime({
				baseValue: bg.offsetY ?? DEFAULT_TEXT_BACKGROUND.offsetY,
				animations: this.params.animations,
				propertyPath: "background.offsetY",
				localTime,
			}),
			cornerRadius: resolveNumberAtTime({
				baseValue: bg.cornerRadius ?? CORNER_RADIUS_MIN,
				animations: this.params.animations,
				propertyPath: "background.cornerRadius",
				localTime,
			}),
		};

	const drawContent = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
			ctx.font = fontString;
			ctx.textAlign = this.params.textAlign;
			ctx.textBaseline = baseline;
			ctx.fillStyle = textColor;
			if ("letterSpacing" in ctx) {
				(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
			}

			if (
				this.params.background.enabled &&
				this.params.background.color &&
				this.params.background.color !== "transparent" &&
				lineCount > 0
			) {
				const backgroundRect = getTextBackgroundRect({
					textAlign: this.params.textAlign,
					block,
					background: resolvedBackground,
					fontSizeRatio,
				});
				if (backgroundRect) {
					const p = clamp({ value: resolvedBackground.cornerRadius, min: CORNER_RADIUS_MIN, max: CORNER_RADIUS_MAX }) / 100;
					const radius = Math.min(backgroundRect.width, backgroundRect.height) / 2 * p;
				ctx.fillStyle = resolvedBackground.color;
				ctx.beginPath();
				ctx.roundRect(backgroundRect.left, backgroundRect.top, backgroundRect.width, backgroundRect.height, radius);
				ctx.fill();
				ctx.fillStyle = textColor;
				}
			}

			const highlightColor = this.params.highlightColor ?? "#FACC15";

			// Resolve word timings: prefer element data, fall back to transcript store
			const resolvedWordTimings: TextWordTiming[] = (() => {
				const elementTimings = this.params.wordTimings;
				if (Array.isArray(elementTimings) && elementTimings.length > 0) {
					return elementTimings;
				}

				// Look up from transcript store by matching time range
				const transcriptSegments = useTranscriptStore.getState().segments;
				const elementStart = this.params.startTime;
				const elementEnd = elementStart + this.params.duration;
				const matchingSegment = transcriptSegments.find(
					(seg) =>
						Math.abs(seg.start - elementStart) < 0.1 &&
						Math.abs(seg.end - elementEnd) < 0.1,
				);
				if (matchingSegment?.words && matchingSegment.words.length > 0) {
					return matchingSegment.words.map((w) => ({
						word: w.word,
						start: w.start - matchingSegment.start,
						end: w.end - matchingSegment.start,
					}));
				}

				return [];
			})();

			const hasKaraoke = resolvedWordTimings.length > 0;

			// Running word index across lines for karaoke
			let karaokeWordOffset = 0;

			for (let i = 0; i < lineCount; i++) {
				const lineY = i * lineHeightPx - block.visualCenterOffset;

				if (hasKaraoke) {
					// Count words in this line to slice the correct timing range
					const lineWordCount = lines[i]
						.split(/\s+/)
						.filter((w) => w.length > 0).length;

					this.drawKaraokeText({
						ctx,
						line: lines[i],
						lineY,
						localTime,
						wordTimings: resolvedWordTimings.slice(
							karaokeWordOffset,
							karaokeWordOffset + lineWordCount,
						),
						defaultColor: textColor,
						highlightColor,
						textAlign: this.params.textAlign,
					});

					karaokeWordOffset += lineWordCount;
				} else {
					ctx.fillText(lines[i], 0, lineY);
				}

				drawTextDecoration({
					ctx,
					textDecoration: this.params.textDecoration ?? "none",
					lineWidth: lineMetrics[i].width,
					lineY,
					metrics: lineMetrics[i],
					scaledFontSize,
					textAlign: this.params.textAlign,
				});
			}
		};

		const applyTransform = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
			ctx.translate(x, y);
			ctx.scale(transform.scale, transform.scale);
			if (transform.rotate) {
				ctx.rotate((transform.rotate * Math.PI) / 180);
			}
		};

		const enabledEffects = this.params.effects?.filter((effect) => effect.enabled) ?? [];

		if (enabledEffects.length === 0) {
			renderer.context.save();
			applyTransform(renderer.context);
			renderer.context.globalCompositeOperation = blendMode;
			renderer.context.globalAlpha = opacity;
			drawContent(renderer.context);
			renderer.context.restore();
			return;
		}

		// Effects path: render text to a same-size offscreen canvas so the blur
		// can spread into the surrounding transparent area without hard clipping.
		const offscreen = createOffscreenCanvas({ width: renderer.width, height: renderer.height });
		const offscreenCtx = offscreen.getContext("2d") as OffscreenCanvasRenderingContext2D | null;

		if (!offscreenCtx) {
		renderer.context.save();
			applyTransform(renderer.context);
			renderer.context.globalCompositeOperation = blendMode;
			renderer.context.globalAlpha = opacity;
			drawContent(renderer.context);
			renderer.context.restore();
			return;
		}

		offscreenCtx.save();
		applyTransform(offscreenCtx);
		drawContent(offscreenCtx);
		offscreenCtx.restore();

		let currentSource: CanvasImageSource = offscreen;
		for (const effect of enabledEffects) {
			const resolvedParams = resolveEffectParamsAtTime({
				effect,
				animations: this.params.animations,
				localTime,
			});
			const definition = getEffect({ effectType: effect.type });
			const passes = definition.renderer.passes.map((pass) => ({
				fragmentShader: pass.fragmentShader,
				uniforms: pass.uniforms({
					effectParams: resolvedParams,
					width: renderer.width,
					height: renderer.height,
				}),
			}));
			currentSource = webglEffectRenderer.applyEffect({
				source: currentSource,
				width: renderer.width,
				height: renderer.height,
				passes,
			});
		}

		renderer.context.save();
		renderer.context.globalCompositeOperation = blendMode;
		renderer.context.globalAlpha = opacity;
		renderer.context.drawImage(currentSource, 0, 0);
		renderer.context.restore();
	}
}
