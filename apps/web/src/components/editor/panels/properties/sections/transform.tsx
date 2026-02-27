import { NumberField } from "@/components/ui/number-field";
import { useEditor } from "@/hooks/use-editor";
import { clamp, isNearlyEqual } from "@/utils/math";
import type { AnimationPropertyPath } from "@/types/animation";
import type { VisualElement } from "@/types/timeline";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
} from "../section";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowExpandIcon,
	Link05Icon,
	RotateClockwiseIcon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { DEFAULT_TRANSFORM } from "@/constants/timeline-constants";
import { TIME_EPSILON_SECONDS } from "@/constants/animation-constants";
import { getElementLocalTime, resolveTransformAtTime } from "@/lib/animation";
import { KeyframeToggle } from "../keyframe-toggle";
import { useKeyframedNumberProperty } from "../hooks/use-keyframed-number-property";

function parseNumericInput({ input }: { input: string }): number | null {
	const parsed = parseFloat(input);
	return Number.isNaN(parsed) ? null : parsed;
}

function isPropertyAtDefault({
	hasAnimatedKeyframes,
	isPlayheadWithinElementRange,
	resolvedValue,
	staticValue,
	defaultValue,
}: {
	hasAnimatedKeyframes: boolean;
	isPlayheadWithinElementRange: boolean;
	resolvedValue: number;
	staticValue: number;
	defaultValue: number;
}): boolean {
	if (hasAnimatedKeyframes && isPlayheadWithinElementRange) {
		return isNearlyEqual({
			leftValue: resolvedValue,
			rightValue: defaultValue,
		});
	}

	return staticValue === defaultValue;
}

export function TransformSection({
	element,
	trackId,
}: {
	element: VisualElement;
	trackId: string;
}) {
	const editor = useEditor();
	const [isScaleLocked, setIsScaleLocked] = useState(false);
	const playheadTime = editor.playback.getCurrentTime();
	const localTime = getElementLocalTime({
		timelineTime: playheadTime,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const resolvedTransform = resolveTransformAtTime({
		baseTransform: element.transform,
		animations: element.animations,
		localTime,
	});
	const isPlayheadWithinElementRange =
		playheadTime >= element.startTime - TIME_EPSILON_SECONDS &&
		playheadTime <= element.startTime + element.duration + TIME_EPSILON_SECONDS;

	const positionX = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "transform.position.x",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedTransform.position.x).toString(),
		parse: (input) => parseNumericInput({ input }),
		valueAtPlayhead: resolvedTransform.position.x,
		buildBaseUpdates: ({ value }) => ({
			transform: {
				...element.transform,
				position: {
					...element.transform.position,
					x: value,
				},
			},
		}),
	});

	const positionY = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "transform.position.y",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedTransform.position.y).toString(),
		parse: (input) => parseNumericInput({ input }),
		valueAtPlayhead: resolvedTransform.position.y,
		buildBaseUpdates: ({ value }) => ({
			transform: {
				...element.transform,
				position: {
					...element.transform.position,
					y: value,
				},
			},
		}),
	});

	const scale = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "transform.scale",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedTransform.scale * 100).toString(),
		parse: (input) => {
			const parsed = parseNumericInput({ input });
			if (parsed === null) return null;
			return Math.max(parsed, 1) / 100;
		},
		valueAtPlayhead: resolvedTransform.scale,
		buildBaseUpdates: ({ value }) => ({
			transform: {
				...element.transform,
				scale: value,
			},
		}),
	});
	const scaleFieldProps = {
		className: "flex-1",
		value: scale.displayValue,
		onFocus: scale.onFocus,
		onChange: scale.onChange,
		onBlur: scale.onBlur,
		dragSensitivity: "slow" as const,
		onScrub: scale.scrubTo,
		onScrubEnd: scale.commitScrub,
		onReset: () => scale.commitValue({ value: DEFAULT_TRANSFORM.scale }),
		isDefault: isPropertyAtDefault({
			hasAnimatedKeyframes: scale.hasAnimatedKeyframes,
			isPlayheadWithinElementRange,
			resolvedValue: resolvedTransform.scale,
			staticValue: element.transform.scale,
			defaultValue: DEFAULT_TRANSFORM.scale,
		}),
	};

	const rotation = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "transform.rotate",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedTransform.rotate).toString(),
		parse: (input) => {
			const parsed = parseNumericInput({ input });
			if (parsed === null) return null;
			return clamp({ value: parsed, min: -360, max: 360 });
		},
		valueAtPlayhead: resolvedTransform.rotate,
		buildBaseUpdates: ({ value }) => ({
			transform: {
				...element.transform,
				rotate: value,
			},
		}),
	});

	const hasPositionKeyframe =
		positionX.isKeyframedAtTime || positionY.isKeyframedAtTime;

	const togglePositionKeyframe = () => {
		if (!isPlayheadWithinElementRange) {
			return;
		}

		if (positionX.keyframeIdAtTime || positionY.keyframeIdAtTime) {
			const keyframesToRemove: Array<{
				trackId: string;
				elementId: string;
				propertyPath: AnimationPropertyPath;
				keyframeId: string;
			}> = [];
			if (positionX.keyframeIdAtTime) {
				keyframesToRemove.push({
					trackId,
					elementId: element.id,
					propertyPath: "transform.position.x" as const,
					keyframeId: positionX.keyframeIdAtTime,
				});
			}
			if (positionY.keyframeIdAtTime) {
				keyframesToRemove.push({
					trackId,
					elementId: element.id,
					propertyPath: "transform.position.y" as const,
					keyframeId: positionY.keyframeIdAtTime,
				});
			}

			editor.timeline.removeKeyframes({
				keyframes: keyframesToRemove,
			});
			return;
		}

		editor.timeline.upsertKeyframes({
			keyframes: [
				{
					trackId,
					elementId: element.id,
					propertyPath: "transform.position.x",
					time: localTime,
					value: resolvedTransform.position.x,
				},
				{
					trackId,
					elementId: element.id,
					propertyPath: "transform.position.y",
					time: localTime,
					value: resolvedTransform.position.y,
				},
			],
		});
	};

	return (
		<Section collapsible sectionKey={`${element.type}:transform`}>
			<SectionHeader title="Transform" />
			<SectionContent>
				<SectionFields>
					<SectionField
						label="Scale"
						beforeLabel={
							<KeyframeToggle
								isActive={scale.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle scale keyframe"
								onToggle={scale.toggleKeyframe}
							/>
						}
					>
						<div className="flex items-center gap-2">
							{isScaleLocked ? (
								<>
									<NumberField icon="W" {...scaleFieldProps} />
									<NumberField icon="H" {...scaleFieldProps} />
								</>
							) : (
									<NumberField
										icon={<HugeiconsIcon icon={ArrowExpandIcon} />}
										{...scaleFieldProps}
										className="flex-1"
									/>
							)}
							<Button
								type="button"
								variant={isScaleLocked ? "secondary" : "ghost"}
								size="icon"
								aria-pressed={isScaleLocked}
								onClick={() => setIsScaleLocked((isLocked) => !isLocked)}
							>
								<HugeiconsIcon icon={Link05Icon} />
							</Button>
						</div>
					</SectionField>
					<SectionField
						label="Position"
						beforeLabel={
							<KeyframeToggle
								isActive={hasPositionKeyframe}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle position keyframe"
								onToggle={togglePositionKeyframe}
							/>
						}
					>
						<div className="flex items-center gap-2">
							<NumberField
								icon="X"
								className="flex-1"
								value={positionX.displayValue}
								onFocus={positionX.onFocus}
								onChange={positionX.onChange}
								onBlur={positionX.onBlur}
								onScrub={positionX.scrubTo}
								onScrubEnd={positionX.commitScrub}
								onReset={() =>
									positionX.commitValue({ value: DEFAULT_TRANSFORM.position.x })
								}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: positionX.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedTransform.position.x,
									staticValue: element.transform.position.x,
									defaultValue: DEFAULT_TRANSFORM.position.x,
								})}
							/>
							<NumberField
								icon="Y"
								className="flex-1"
								value={positionY.displayValue}
								onFocus={positionY.onFocus}
								onChange={positionY.onChange}
								onBlur={positionY.onBlur}
								onScrub={positionY.scrubTo}
								onScrubEnd={positionY.commitScrub}
								onReset={() =>
									positionY.commitValue({ value: DEFAULT_TRANSFORM.position.y })
								}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: positionY.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedTransform.position.y,
									staticValue: element.transform.position.y,
									defaultValue: DEFAULT_TRANSFORM.position.y,
								})}
							/>
						</div>
					</SectionField>

					<SectionField
						label="Rotation"
						beforeLabel={
							<KeyframeToggle
								isActive={rotation.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle rotation keyframe"
								onToggle={rotation.toggleKeyframe}
							/>
						}
					>
						<div className="flex items-center gap-2">
							<NumberField
								icon={<HugeiconsIcon icon={RotateClockwiseIcon} />}
								className="flex-none"
								value={rotation.displayValue}
								onFocus={rotation.onFocus}
								onChange={rotation.onChange}
								onBlur={rotation.onBlur}
								dragSensitivity="slow"
								onScrub={rotation.scrubTo}
								onScrubEnd={rotation.commitScrub}
								onReset={() =>
									rotation.commitValue({ value: DEFAULT_TRANSFORM.rotate })
								}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: rotation.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedTransform.rotate,
									staticValue: element.transform.rotate,
									defaultValue: DEFAULT_TRANSFORM.rotate,
								})}
							/>
						</div>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
