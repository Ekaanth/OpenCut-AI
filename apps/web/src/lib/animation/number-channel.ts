import type {
	AnimationPropertyPath,
	ElementAnimations,
	NumberAnimationChannel,
} from "@/types/animation";

export function getNumberChannelForPath({
	animations,
	propertyPath,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
}): NumberAnimationChannel | undefined {
	const channel = animations?.channels[propertyPath];
	if (!channel || channel.valueKind !== "number") {
		return undefined;
	}

	return channel;
}
