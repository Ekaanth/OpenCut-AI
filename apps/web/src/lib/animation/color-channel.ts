import type {
	AnimationPropertyPath,
	ColorAnimationChannel,
	ElementAnimations,
} from "@/types/animation";

export function getColorChannelForPath({
	animations,
	propertyPath,
}: {
	animations: ElementAnimations | undefined;
	propertyPath: AnimationPropertyPath;
}): ColorAnimationChannel | undefined {
	const channel = animations?.channels[propertyPath];
	if (!channel || channel.valueKind !== "color") {
		return undefined;
	}
	return channel;
}
