import type {
	AnimationInterpolation,
	AnimationPropertyPath,
	AnimationValue,
	AnimationValueKind,
	DiscreteValue,
} from "@/types/animation";
import type { TimelineElement } from "@/types/timeline";
import { MIN_TRANSFORM_SCALE } from "@/constants/animation-constants";
import { isVisualElement } from "@/lib/timeline/element-utils";

interface NumericRange {
	min?: number;
	max?: number;
}

interface AnimationPropertyDefinition {
	valueKind: AnimationValueKind;
	defaultInterpolation: AnimationInterpolation;
	numericRange?: NumericRange;
	supportsElement: ({ element }: { element: TimelineElement }) => boolean;
	getValue: ({ element }: { element: TimelineElement }) => number | null;
	setValue: ({
		element,
		value,
	}: {
		element: TimelineElement;
		value: number;
	}) => TimelineElement;
}

const ANIMATION_PROPERTY_REGISTRY: Record<
	AnimationPropertyPath,
	AnimationPropertyDefinition
> = {
	"transform.position.x": {
		valueKind: "number",
		defaultInterpolation: "linear",
		supportsElement: ({ element }) => isVisualElement(element),
		getValue: ({ element }) =>
			isVisualElement(element) ? element.transform.position.x : null,
		setValue: ({ element, value }) =>
			isVisualElement(element)
				? {
						...element,
						transform: {
							...element.transform,
							position: { ...element.transform.position, x: value },
						},
					}
				: element,
	},
	"transform.position.y": {
		valueKind: "number",
		defaultInterpolation: "linear",
		supportsElement: ({ element }) => isVisualElement(element),
		getValue: ({ element }) =>
			isVisualElement(element) ? element.transform.position.y : null,
		setValue: ({ element, value }) =>
			isVisualElement(element)
				? {
						...element,
						transform: {
							...element.transform,
							position: { ...element.transform.position, y: value },
						},
					}
				: element,
	},
	"transform.scale": {
		valueKind: "number",
		defaultInterpolation: "linear",
		numericRange: { min: MIN_TRANSFORM_SCALE },
		supportsElement: ({ element }) => isVisualElement(element),
		getValue: ({ element }) =>
			isVisualElement(element) ? element.transform.scale : null,
		setValue: ({ element, value }) =>
			isVisualElement(element)
				? { ...element, transform: { ...element.transform, scale: value } }
				: element,
	},
	"transform.rotate": {
		valueKind: "number",
		defaultInterpolation: "linear",
		supportsElement: ({ element }) => isVisualElement(element),
		getValue: ({ element }) =>
			isVisualElement(element) ? element.transform.rotate : null,
		setValue: ({ element, value }) =>
			isVisualElement(element)
				? { ...element, transform: { ...element.transform, rotate: value } }
				: element,
	},
	opacity: {
		valueKind: "number",
		defaultInterpolation: "linear",
		numericRange: { min: 0, max: 1 },
		supportsElement: ({ element }) => isVisualElement(element),
		getValue: ({ element }) =>
			isVisualElement(element) ? element.opacity : null,
		setValue: ({ element, value }) =>
			isVisualElement(element) ? { ...element, opacity: value } : element,
	},
	volume: {
		valueKind: "number",
		defaultInterpolation: "linear",
		numericRange: { min: 0, max: 1 },
		supportsElement: ({ element }) => element.type === "audio",
		getValue: ({ element }) =>
			element.type === "audio" ? element.volume : null,
		setValue: ({ element, value }) =>
			element.type === "audio" ? { ...element, volume: value } : element,
	},
};

export function isAnimationPropertyPath({
	propertyPath,
}: {
	propertyPath: string;
}): boolean {
	return propertyPath in ANIMATION_PROPERTY_REGISTRY;
}

export function getAnimationPropertyDefinition({
	propertyPath,
}: {
	propertyPath: AnimationPropertyPath;
}): AnimationPropertyDefinition {
	return ANIMATION_PROPERTY_REGISTRY[propertyPath];
}

export function supportsAnimationProperty({
	element,
	propertyPath,
}: {
	element: TimelineElement;
	propertyPath: AnimationPropertyPath;
}): boolean {
	const propertyDefinition = getAnimationPropertyDefinition({ propertyPath });
	return propertyDefinition.supportsElement({ element });
}

export function getElementBaseValueForProperty({
	element,
	propertyPath,
}: {
	element: TimelineElement;
	propertyPath: AnimationPropertyPath;
}): AnimationValue | null {
	const definition = getAnimationPropertyDefinition({ propertyPath });
	if (!definition.supportsElement({ element })) {
		return null;
	}
	return definition.getValue({ element });
}

export function withElementBaseValueForProperty({
	element,
	propertyPath,
	value,
}: {
	element: TimelineElement;
	propertyPath: AnimationPropertyPath;
	value: AnimationValue;
}): TimelineElement {
	const coercedValue = coerceAnimationValueForProperty({ propertyPath, value });
	if (coercedValue === null || typeof coercedValue !== "number") {
		return element;
	}
	const definition = getAnimationPropertyDefinition({ propertyPath });
	if (!definition.supportsElement({ element })) {
		return element;
	}
	return definition.setValue({ element, value: coercedValue });
}

export function getDefaultInterpolationForProperty({
	propertyPath,
}: {
	propertyPath: AnimationPropertyPath;
}): AnimationInterpolation {
	const propertyDefinition = getAnimationPropertyDefinition({ propertyPath });
	return propertyDefinition.defaultInterpolation;
}

function clampNumericRange({
	value,
	numericRange,
}: {
	value: number;
	numericRange: NumericRange | undefined;
}): number {
	if (!numericRange) {
		return value;
	}

	const minValue = numericRange.min ?? Number.NEGATIVE_INFINITY;
	const maxValue = numericRange.max ?? Number.POSITIVE_INFINITY;
	return Math.min(maxValue, Math.max(minValue, value));
}

export function coerceAnimationValueForProperty({
	propertyPath,
	value,
}: {
	propertyPath: AnimationPropertyPath;
	value: AnimationValue;
}): AnimationValue | null {
	const propertyDefinition = getAnimationPropertyDefinition({ propertyPath });

	if (propertyDefinition.valueKind === "number") {
		if (typeof value !== "number" || Number.isNaN(value)) {
			return null;
		}

		return clampNumericRange({
			value,
			numericRange: propertyDefinition.numericRange,
		});
	}

	if (propertyDefinition.valueKind === "color") {
		return typeof value === "string" ? value : null;
	}

	if (typeof value === "string" || typeof value === "boolean") {
		return value as DiscreteValue;
	}

	return null;
}
