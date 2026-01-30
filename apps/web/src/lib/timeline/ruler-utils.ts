import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

/**
 * Frame intervals for labels - starts at 2 so there's always at least
 * one tick between labels even at max zoom.
 * Pattern: 2, 3, 5, 10, 15 (matches CapCut)
 */
const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;

/**
 * Frame intervals for ticks - can go down to 1 for max granularity.
 */
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;

/**
 * Second intervals for when we're zoomed out past frame-level detail.
 */
const SECOND_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 30, 60] as const;

/**
 * Minimum pixel spacing between labels to keep them readable
 */
const MIN_LABEL_SPACING_PX = 120;

/**
 * Minimum pixel spacing between ticks. Much denser than labels.
 */
const MIN_TICK_SPACING_PX = 18;

export interface RulerConfig {
	/** Time interval in seconds between each label */
	labelIntervalSeconds: number;
	/** Time interval in seconds between each tick */
	tickIntervalSeconds: number;
}

/**
 * Determines the optimal label and tick intervals based on zoom level and FPS.
 *
 * Labels and ticks scale independently:
 * - Labels need wide spacing (~50px) to stay readable
 * - Ticks can be denser (~8px) to show finer subdivisions
 *
 * Example at different zoom levels:
 * - Very zoomed in: labels every 2f, ticks every 1f
 * - Zoomed in: labels every 10f, ticks every 1f
 * - Zoomed out: labels every 15f, ticks every 3f
 * - Very zoomed out: labels every 1s, ticks every 5f
 */
export function getRulerConfig({
	zoomLevel,
	fps,
}: {
	zoomLevel: number;
	fps: number;
}): RulerConfig {
	const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
	const pixelsPerFrame = pixelsPerSecond / fps;

	const labelIntervalSeconds = findOptimalInterval({
		pixelsPerFrame,
		pixelsPerSecond,
		fps,
		minSpacingPx: MIN_LABEL_SPACING_PX,
		frameIntervals: LABEL_FRAME_INTERVALS,
	});

	const rawTickIntervalSeconds = findOptimalInterval({
		pixelsPerFrame,
		pixelsPerSecond,
		fps,
		minSpacingPx: MIN_TICK_SPACING_PX,
		frameIntervals: TICK_FRAME_INTERVALS,
	});

	// Ensure tick interval divides evenly into label interval so labels always land on ticks
	const tickIntervalSeconds = ensureTickDividesLabel({
		tickIntervalSeconds: rawTickIntervalSeconds,
		labelIntervalSeconds,
		pixelsPerFrame,
		fps,
	});

	return { labelIntervalSeconds, tickIntervalSeconds };
}

/**
 * Adjusts tick interval to ensure it divides evenly into the label interval.
 * This guarantees labels always land on tick positions.
 */
function ensureTickDividesLabel({
	tickIntervalSeconds,
	labelIntervalSeconds,
	pixelsPerFrame,
	fps,
}: {
	tickIntervalSeconds: number;
	labelIntervalSeconds: number;
	pixelsPerFrame: number;
	fps: number;
}): number {
	const labelFrames = Math.round(labelIntervalSeconds * fps);
	const tickFrames = Math.round(tickIntervalSeconds * fps);

	// If tick already divides label evenly, we're good
	if (labelFrames % tickFrames === 0) {
		return tickIntervalSeconds;
	}

	// Find the smallest tick interval that divides the label interval and has adequate spacing
	for (const candidateFrames of TICK_FRAME_INTERVALS) {
		if (labelFrames % candidateFrames === 0) {
			const candidateSpacing = pixelsPerFrame * candidateFrames;
			// Accept if spacing meets minimum threshold
			if (candidateSpacing >= MIN_TICK_SPACING_PX) {
				return candidateFrames / fps;
			}
		}
	}

	// Fallback: use the label interval itself (no intermediate ticks)
	return labelIntervalSeconds;
}

function findOptimalInterval({
	pixelsPerFrame,
	pixelsPerSecond,
	fps,
	minSpacingPx,
	frameIntervals,
}: {
	pixelsPerFrame: number;
	pixelsPerSecond: number;
	fps: number;
	minSpacingPx: number;
	frameIntervals: readonly number[];
}): number {
	// Try frame-level intervals first
	for (const frameInterval of frameIntervals) {
		const pixelSpacing = pixelsPerFrame * frameInterval;
		if (pixelSpacing >= minSpacingPx) {
			return frameInterval / fps;
		}
	}

	// Then try second-level intervals
	for (const secondMultiplier of SECOND_MULTIPLIERS) {
		const pixelSpacing = pixelsPerSecond * secondMultiplier;
		if (pixelSpacing >= minSpacingPx) {
			return secondMultiplier;
		}
	}

	return 60;
}

/**
 * Checks if a time should have a label based on the label interval.
 */
export function shouldShowLabel({
	time,
	labelIntervalSeconds,
}: {
	time: number;
	labelIntervalSeconds: number;
}): boolean {
	const epsilon = 0.0001;
	const remainder = time % labelIntervalSeconds;
	return remainder < epsilon || remainder > labelIntervalSeconds - epsilon;
}

/**
 * Formats a ruler tick label.
 *
 * - On second boundaries: "MM:SS" (e.g., "00:00", "01:30")
 * - Between seconds: "Xf" (e.g., "5f", "15f")
 */
export function formatRulerLabel({
	timeInSeconds,
	fps,
}: {
	timeInSeconds: number;
	fps: number;
}): string {
	if (isSecondBoundary({ timeInSeconds })) {
		return formatTimestamp({ timeInSeconds });
	}

	const frameWithinSecond = getFrameWithinSecond({ timeInSeconds, fps });
	return `${frameWithinSecond}f`;
}

/**
 * Checks if a time falls exactly on a second boundary.
 */
function isSecondBoundary({
	timeInSeconds,
}: {
	timeInSeconds: number;
}): boolean {
	const epsilon = 0.0001;
	const remainder = timeInSeconds % 1;
	return remainder < epsilon || remainder > 1 - epsilon;
}

/**
 * Gets the frame number within the current second.
 */
function getFrameWithinSecond({
	timeInSeconds,
	fps,
}: {
	timeInSeconds: number;
	fps: number;
}): number {
	const fractionalPart = timeInSeconds % 1;
	return Math.round(fractionalPart * fps);
}

/**
 * Formats a timestamp as MM:SS.
 */
function formatTimestamp({ timeInSeconds }: { timeInSeconds: number }): string {
	const totalSeconds = Math.round(timeInSeconds);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
