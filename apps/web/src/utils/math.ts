export function clamp({
	value,
	min,
	max,
}: {
	value: number;
	min: number;
	max: number;
}): number {
	return Math.max(min, Math.min(max, value));
}

export function isNearlyEqual({
	leftValue,
	rightValue,
	epsilon = 0.0001,
}: {
	leftValue: number;
	rightValue: number;
	epsilon?: number;
}): boolean {
	return Math.abs(leftValue - rightValue) <= epsilon;
}

export function evaluateMathExpression({
	input,
}: {
	input: string;
}): number | null {
	const sanitized = input.trim();
	if (!/^[\d.\s+\-*/()]+$/.test(sanitized)) return null;
	try {
		const result = new Function(`return (${sanitized})`)();
		if (typeof result !== "number" || !Number.isFinite(result)) return null;
		return result;
	} catch {
		return null;
	}
}
