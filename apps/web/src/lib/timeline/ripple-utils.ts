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
