/**
 * Popover-style subtitle presets.
 *
 * Each word appears as an independent text element when spoken and stays
 * visible until the sentence/segment ends. Words can be freely repositioned
 * on the canvas, giving the "popover" look used by viral podcast clips.
 */

import type { CreateTextElement } from "@/types/timeline";
import type { ElementAnimations } from "@/types/animation";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";

export type PopoverSubtitlePreset = "word-pop" | "hormozi" | "highlight" | "classic-podcast";

export interface PopoverSubtitleConfig {
	id: PopoverSubtitlePreset;
	name: string;
	description: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: "normal" | "bold";
	color: string;
	highlightColor: string;
	backgroundColor: string;
	backgroundEnabled: boolean;
	backgroundCornerRadius: number;
	backgroundPaddingX: number;
	backgroundPaddingY: number;
	/** Y position as ratio of canvas height (0 = top, 1 = bottom) */
	yPositionRatio: number;
	/** Scale multiplier for the word pop-in animation (1.0 = no pop, 1.3 = 30% larger) */
	wordPopScale: number;
}

export const POPOVER_SUBTITLE_PRESETS: PopoverSubtitleConfig[] = [
	{
		id: "word-pop",
		name: "Word Pop",
		description: "Each spoken word pops in and stays visible",
		fontSize: 8,
		fontFamily: "Inter",
		fontWeight: "bold",
		color: "#FFFFFF",
		highlightColor: "#FACC15",
		backgroundColor: "transparent",
		backgroundEnabled: false,
		backgroundCornerRadius: 0,
		backgroundPaddingX: 0,
		backgroundPaddingY: 0,
		yPositionRatio: 0.35,
		wordPopScale: 1.4,
	},
	{
		id: "hormozi",
		name: "Hormozi",
		description: "Large bold words pop in one by one, colored keywords",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
		color: "#FFFFFF",
		highlightColor: "#EF4444",
		backgroundColor: "transparent",
		backgroundEnabled: false,
		backgroundCornerRadius: 0,
		backgroundPaddingX: 0,
		backgroundPaddingY: 0,
		yPositionRatio: 0.35,
		wordPopScale: 1.3,
	},
	{
		id: "highlight",
		name: "Highlight",
		description: "Color flash on keywords with pop-in effect",
		fontSize: 6,
		fontFamily: "Inter",
		fontWeight: "bold",
		color: "#FFFFFF",
		highlightColor: "#06B6D4",
		backgroundColor: "#000000",
		backgroundEnabled: true,
		backgroundCornerRadius: 6,
		backgroundPaddingX: 16,
		backgroundPaddingY: 8,
		yPositionRatio: 0.38,
		wordPopScale: 1.25,
	},
	{
		id: "classic-podcast",
		name: "Classic Podcast",
		description: "Clean bottom subtitles, words appear as spoken",
		fontSize: 4,
		fontFamily: "Inter",
		fontWeight: "bold",
		color: "#FFFFFF",
		highlightColor: "#FACC15",
		backgroundColor: "#000000",
		backgroundEnabled: true,
		backgroundCornerRadius: 4,
		backgroundPaddingX: 12,
		backgroundPaddingY: 6,
		yPositionRatio: 0.38,
		wordPopScale: 1.15,
	},
];

export function getPopoverSubtitlePreset(id: PopoverSubtitlePreset): PopoverSubtitleConfig {
	return POPOVER_SUBTITLE_PRESETS.find((p) => p.id === id) ?? POPOVER_SUBTITLE_PRESETS[0];
}

/**
 * Apply keyword colors to word timings.
 * Returns a map of word → color for rendering.
 */
export function buildKeywordColorMap(
	keywords: { word: string; color: string }[],
): Map<string, string> {
	const map = new Map<string, string>();
	for (const kw of keywords) {
		map.set(kw.word.toLowerCase(), kw.color);
	}
	return map;
}

/**
 * Check if a time range overlaps any card time range.
 */
function overlapsCardRange(
	start: number,
	end: number,
	cardRanges: { start: number; end: number }[],
): boolean {
	for (const card of cardRanges) {
		if (start < card.end && end > card.start) return true;
	}
	return false;
}

/**
 * Estimate the visual width of a word in canvas units.
 * Uses a rough character-width multiplier for bold sans-serif fonts.
 */
function estimateWordWidth(word: string, fontSize: number): number {
	// Narrower chars get a lower multiplier; this is an approximation
	return word.length * fontSize * 0.55;
}

/**
 * Arrange words into centered rows that fit within a max width.
 * Returns x positions for each word index.
 */
function layoutWordsInRows(
	words: string[],
	fontSize: number,
	maxWidth: number,
): { x: number; row: number }[] {
	const gap = fontSize * 0.6;
	const positions: { x: number; row: number }[] = [];

	let currentRow = 0;
	let rowStart = 0;

	while (rowStart < words.length) {
		// Figure out how many words fit in this row
		let rowEnd = rowStart;
		let rowWidth = estimateWordWidth(words[rowStart], fontSize);

		while (rowEnd + 1 < words.length) {
			const nextWidth = estimateWordWidth(words[rowEnd + 1], fontSize);
			if (rowWidth + gap + nextWidth > maxWidth) break;
			rowWidth += gap + nextWidth;
			rowEnd++;
		}

		// Position each word in this row, centered around x=0
		let cursor = -rowWidth / 2;
		for (let i = rowStart; i <= rowEnd; i++) {
			const w = estimateWordWidth(words[i], fontSize);
			positions[i] = { x: cursor + w / 2, row: currentRow };
			cursor += w + gap;
		}

		currentRow++;
		rowStart = rowEnd + 1;
	}

	return positions;
}

/**
 * Build a pop-in entry animation for a word element.
 *
 * Scale:   0 → wordPopScale → 1  (quick overshoot then settle)
 * Opacity: 0 → 1                 (instant fade-in)
 *
 * Times are relative to the element's own start (local time).
 */
function buildPopInAnimation(
	wordPopScale: number,
	elementId: number,
): ElementAnimations {
	const idPrefix = `pop-${elementId}`;
	return {
		channels: {
			"transform.scale": {
				valueKind: "number",
				keyframes: [
					{ id: `${idPrefix}-s0`, time: 0, value: 0, interpolation: "linear" },
					{ id: `${idPrefix}-s1`, time: 0.08, value: wordPopScale, interpolation: "linear" },
					{ id: `${idPrefix}-s2`, time: 0.18, value: 1, interpolation: "linear" },
				],
			},
			opacity: {
				valueKind: "number",
				keyframes: [
					{ id: `${idPrefix}-o0`, time: 0, value: 0, interpolation: "linear" },
					{ id: `${idPrefix}-o1`, time: 0.06, value: 1, interpolation: "linear" },
				],
			},
		},
	};
}

/**
 * Build popover-style subtitle elements from transcript segments.
 *
 * Each word becomes its own independent text element that:
 * - Appears when the word is spoken (startTime = word timestamp)
 * - Stays visible until the sentence/segment ends
 * - Can be freely repositioned on the canvas
 * - Gets keyword color coding when applicable
 */
export function buildPopoverSubtitleElements({
	segments,
	preset,
	canvasHeight,
	canvasWidth,
	keywords,
	cardTimeRanges,
}: {
	segments: {
		text: string;
		start: number;
		end: number;
		words: { word: string; start: number; end: number; confidence?: number }[];
	}[];
	preset: PopoverSubtitlePreset;
	canvasHeight: number;
	canvasWidth?: number;
	keywords?: { word: string; color: string }[];
	/** Time ranges where question cards are displayed — words are excluded here */
	cardTimeRanges?: { start: number; end: number }[];
}): (Omit<CreateTextElement, "type"> & { type: "text" })[] {
	const config = getPopoverSubtitlePreset(preset);
	const elements: (Omit<CreateTextElement, "type"> & { type: "text" })[] = [];
	const baseY = canvasHeight * config.yPositionRatio;
	const cards = cardTimeRanges ?? [];
	const keywordMap = keywords ? buildKeywordColorMap(keywords) : null;

	// Row height for multi-row layouts
	const rowHeight = config.fontSize * 1.6;
	// Max row width: use canvas width if available, otherwise a reasonable default
	const maxRowWidth = (canvasWidth ?? canvasHeight * 0.5625) * 0.85;

	let elementIndex = 0;

	for (const seg of segments) {
		// Get word-level timings for this segment
		let segWords: { word: string; start: number; end: number }[];

		if (seg.words && seg.words.length > 0) {
			segWords = seg.words;
		} else {
			// Fallback: split text into words with estimated timings
			const words = seg.text.trim().split(/\s+/);
			const wordDuration = (seg.end - seg.start) / words.length;
			segWords = words.map((w, i) => ({
				word: w,
				start: seg.start + i * wordDuration,
				end: seg.start + (i + 1) * wordDuration,
			}));
		}

		if (segWords.length === 0) continue;

		// Layout words into rows for this segment
		const wordTexts = segWords.map((w) => w.word);
		const positions = layoutWordsInRows(wordTexts, config.fontSize, maxRowWidth);

		for (let i = 0; i < segWords.length; i++) {
			const word = segWords[i];
			const pos = positions[i];

			// Skip words that overlap with question card time ranges
			if (cards.length > 0 && overlapsCardRange(word.start, word.end, cards)) {
				continue;
			}

			// Each word appears when spoken, stays until segment ends
			const startTime = word.start;
			const duration = seg.end - word.start;

			// Skip words with negligible duration
			if (duration < 0.05) continue;

			// Determine color: keyword color takes priority
			const cleanWord = word.word.toLowerCase().replace(/[.,!?;:"']/g, "");
			const kwColor = keywordMap?.get(cleanWord);
			const color = kwColor ?? config.color;
			const highlightColor = kwColor ?? config.highlightColor;

			// Y position with row offset
			const yPosition = baseY + pos.row * rowHeight;

			elementIndex++;

			elements.push({
				...DEFAULT_TEXT_ELEMENT,
				type: "text",
				name: `Popover Sub ${elementIndex}`,
				content: word.word,
				fontSize: config.fontSize,
				fontFamily: config.fontFamily,
				fontWeight: config.fontWeight,
				color,
				highlightColor,
				wordPopScale: config.wordPopScale,
				textAlign: "center",
				startTime,
				duration,
				trimStart: 0,
				trimEnd: 0,
				animations: buildPopInAnimation(config.wordPopScale, elementIndex),
				background: {
					enabled: config.backgroundEnabled,
					color: config.backgroundColor,
					cornerRadius: config.backgroundCornerRadius,
					paddingX: config.backgroundPaddingX,
					paddingY: config.backgroundPaddingY,
					offsetX: 0,
					offsetY: 0,
				},
				opacity: 1,
				transform: {
					scale: 1,
					position: { x: pos.x, y: yPosition },
					rotate: 0,
				},
			});
		}
	}

	return elements;
}

type PopoverElement = Omit<CreateTextElement, "type"> & { type: "text" };

/**
 * Distribute popover elements across the minimum number of tracks
 * so that no two time-overlapping elements share a track.
 *
 * This is what makes multiple words visible on screen simultaneously:
 * each word lives on its own track layer, so the editor renders
 * them all at once and you can drag each one independently.
 *
 * Returns an array of track buckets — each bucket is one track's worth
 * of non-overlapping elements.
 */
export function distributeElementsToTracks(
	elements: PopoverElement[],
): PopoverElement[][] {
	if (elements.length === 0) return [];

	// Sort by start time for greedy packing
	const sorted = [...elements].sort((a, b) => a.startTime - b.startTime);

	const tracks: PopoverElement[][] = [];
	// The end-time of the last element placed on each track
	const trackEnds: number[] = [];

	for (const el of sorted) {
		const elEnd = el.startTime + el.duration;

		// Find first track where this element doesn't overlap
		let assigned = false;
		for (let t = 0; t < tracks.length; t++) {
			if (el.startTime >= trackEnds[t]) {
				tracks[t].push(el);
				trackEnds[t] = elEnd;
				assigned = true;
				break;
			}
		}

		if (!assigned) {
			tracks.push([el]);
			trackEnds.push(elEnd);
		}
	}

	return tracks;
}
