import type { TimelineElement } from "@/types/timeline";

export function rippleShiftElements({
	elements,
	afterTime,
	shiftAmount,
}: {
	elements: TimelineElement[];
	afterTime: number;
	shiftAmount: number;
}): TimelineElement[] {
	return elements.map((element) =>
		element.startTime >= afterTime
			? { ...element, startTime: element.startTime - shiftAmount }
			: element,
	);
}

export function computeRippleTrim({
	elements,
	elementId,
	newTrimStart,
	newTrimEnd,
	newStartTime,
}: {
	elements: TimelineElement[];
	elementId: string;
	newTrimStart: number;
	newTrimEnd: number;
	newStartTime: number;
}): { elements: TimelineElement[]; trimDelta: number } {
	const element = elements.find((e) => e.id === elementId);
	if (!element) return { elements, trimDelta: 0 };

	const oldEnd = element.startTime + element.duration;
	const newDuration = (element.sourceDuration ?? element.duration + element.trimStart + element.trimEnd) - newTrimStart - newTrimEnd;
	const newEnd = newStartTime + newDuration;
	const trimDelta = newEnd - oldEnd;

	if (Math.abs(trimDelta) < 0.001) {
		return { elements: elements.map((e) => e.id === elementId ? { ...e, trimStart: newTrimStart, trimEnd: newTrimEnd, startTime: newStartTime, duration: newDuration } : e), trimDelta: 0 };
	}

	const updated = elements.map((e) => {
		if (e.id === elementId) {
			return { ...e, trimStart: newTrimStart, trimEnd: newTrimEnd, startTime: newStartTime, duration: newDuration };
		}
		if (e.startTime >= oldEnd - 0.001) {
			return { ...e, startTime: e.startTime + trimDelta };
		}
		return e;
	});

	return { elements: updated, trimDelta };
}
