import type { ChangeCategory } from "@/types/version";

/**
 * Map property paths to human-readable descriptions and categories.
 */

const FLOAT_THRESHOLD = 0.001;

/** Categorize a property change by its path. */
export function categorizeChange(path: string): ChangeCategory {
	const lower = path.toLowerCase();

	// Structure: track/scene level changes
	if (
		lower.includes("tracks") &&
		!lower.includes("elements") &&
		!lower.includes(".")
	)
		return "structure";

	// Timing properties
	if (
		lower.includes("trimstart") ||
		lower.includes("trimend") ||
		lower.includes("starttime") ||
		lower.includes("duration") ||
		lower.includes("playbackrate") ||
		lower.includes("sourceduration")
	)
		return "timing";

	// Audio properties
	if (
		lower.includes("volume") ||
		lower.includes("muted") ||
		(lower.includes("audio") && lower.includes("element"))
	)
		return "audio";

	// Text properties
	if (
		lower.includes("content") ||
		lower.includes("fontfamily") ||
		lower.includes("fontsize") ||
		lower.includes("fontweight") ||
		lower.includes("fontstyle") ||
		lower.includes("textalign") ||
		lower.includes("textdecoration") ||
		lower.includes("letterspacing") ||
		lower.includes("lineheight") ||
		lower.includes("highlightcolor") ||
		lower.includes("wordtimings") ||
		lower.includes("wordpopscale") ||
		lower.includes("background.enabled") ||
		lower.includes("background.color") ||
		lower.includes("background.cornerradius") ||
		lower.includes("background.padding")
	)
		return "text";

	// Visual properties
	if (
		lower.includes("opacity") ||
		lower.includes("transform") ||
		lower.includes("effects") ||
		lower.includes("blendmode") ||
		lower.includes("animations") ||
		lower.includes("color") ||
		lower.includes("hidden")
	)
		return "visual";

	return "content";
}

/** Format a time value in seconds for display. */
function formatTime(value: unknown): string {
	if (typeof value !== "number") return String(value);
	return `${value.toFixed(1)}s`;
}

/** Format a percentage value. */
function formatPercent(value: unknown): string {
	if (typeof value !== "number") return String(value);
	return `${Math.round(value * 100)}%`;
}

/** Extract the property name from a full path. */
function getPropertyName(path: string): string {
	const parts = path.split(".");
	const last = parts[parts.length - 1];
	// Strip array index brackets
	return last.replace(/\[\d+\]$/, "");
}

/** Generate a human-readable description for a property change. */
export function describeChange(
	path: string,
	oldValue: unknown,
	newValue: unknown,
): string {
	const propName = getPropertyName(path).toLowerCase();

	// Timing changes
	if (propName === "trimstart") {
		return `Trim start: ${formatTime(oldValue)} \u2192 ${formatTime(newValue)}`;
	}
	if (propName === "trimend") {
		return `Trim end: ${formatTime(oldValue)} \u2192 ${formatTime(newValue)}`;
	}
	if (propName === "starttime") {
		return `Position: ${formatTime(oldValue)} \u2192 ${formatTime(newValue)}`;
	}
	if (propName === "duration") {
		return `Duration: ${formatTime(oldValue)} \u2192 ${formatTime(newValue)}`;
	}
	if (propName === "playbackrate") {
		return `Playback rate: ${oldValue}x \u2192 ${newValue}x`;
	}

	// Visual changes
	if (propName === "opacity") {
		return `Opacity: ${formatPercent(oldValue)} \u2192 ${formatPercent(newValue)}`;
	}
	if (propName === "blendmode") {
		return `Blend mode: ${oldValue} \u2192 ${newValue}`;
	}
	if (propName === "hidden") {
		return newValue ? "Hidden" : "Made visible";
	}

	// Transform changes
	if (path.includes("transform.position.x")) {
		return `X position: ${Math.round(oldValue as number)} \u2192 ${Math.round(newValue as number)}`;
	}
	if (path.includes("transform.position.y")) {
		return `Y position: ${Math.round(oldValue as number)} \u2192 ${Math.round(newValue as number)}`;
	}
	if (path.includes("transform.scale")) {
		return `Scale: ${formatPercent(oldValue)} \u2192 ${formatPercent(newValue)}`;
	}
	if (path.includes("transform.rotation")) {
		return `Rotation: ${oldValue}\u00b0 \u2192 ${newValue}\u00b0`;
	}

	// Audio changes
	if (propName === "volume") {
		return `Volume: ${formatPercent(oldValue)} \u2192 ${formatPercent(newValue)}`;
	}
	if (propName === "muted") {
		return newValue ? "Muted" : "Unmuted";
	}

	// Text changes
	if (propName === "content") {
		const oldStr = String(oldValue);
		const newStr = String(newValue);
		if (oldStr.length > 30 || newStr.length > 30) {
			return `Text content changed`;
		}
		return `Text: "${oldStr}" \u2192 "${newStr}"`;
	}
	if (propName === "fontfamily") {
		return `Font: ${oldValue} \u2192 ${newValue}`;
	}
	if (propName === "fontsize") {
		return `Font size: ${oldValue}px \u2192 ${newValue}px`;
	}
	if (propName === "fontweight") {
		return `Font weight: ${oldValue} \u2192 ${newValue}`;
	}
	if (propName === "fontstyle") {
		return `Font style: ${oldValue} \u2192 ${newValue}`;
	}
	if (propName === "textalign") {
		return `Text align: ${oldValue} \u2192 ${newValue}`;
	}
	if (propName === "color") {
		return `Color: ${oldValue} \u2192 ${newValue}`;
	}

	// Effect changes
	if (path.includes("effects")) {
		if (path.includes("params")) {
			const paramName = getPropertyName(path);
			return `Effect ${paramName}: ${oldValue} \u2192 ${newValue}`;
		}
		return `Effect changed`;
	}

	// Generic fallback
	return `${getPropertyName(path)}: ${JSON.stringify(oldValue)} \u2192 ${JSON.stringify(newValue)}`;
}

/**
 * Check if two values differ meaningfully (filters floating-point noise).
 */
export function valuesDiffer(a: unknown, b: unknown): boolean {
	if (a === b) return false;
	if (typeof a === "number" && typeof b === "number") {
		return Math.abs(a - b) > FLOAT_THRESHOLD;
	}
	if (a === null || b === null) return a !== b;
	if (typeof a !== typeof b) return true;
	return JSON.stringify(a) !== JSON.stringify(b);
}
