import { Textarea } from "@/components/ui/textarea";
import { FontPicker } from "@/components/ui/font-picker";
import type { TextElement } from "@/types/timeline";
import { NumberField } from "@/components/ui/number-field";
import { useRef } from "react";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "./section";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { uppercase } from "@/utils/string";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_COLOR } from "@/constants/project-constants";
import {
	CORNER_RADIUS_MAX,
	CORNER_RADIUS_MIN,
	DEFAULT_LETTER_SPACING,
	DEFAULT_LINE_HEIGHT,
	DEFAULT_TEXT_BACKGROUND,
	DEFAULT_TEXT_ELEMENT,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "@/constants/text-constants";
import { usePropertyDraft } from "./hooks/use-property-draft";
import { useKeyframedColorProperty } from "./hooks/use-keyframed-color-property";
import { useKeyframedNumberProperty } from "./hooks/use-keyframed-number-property";
import { useElementPlayhead } from "./hooks/use-element-playhead";
import { TransformSection, BlendingSection } from "./sections";
import { KeyframeToggle } from "./keyframe-toggle";
import { isPropertyAtDefault } from "./sections/transform";
import { resolveColorAtTime, resolveNumberAtTime } from "@/lib/animation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	TextFontIcon,
	ViewIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { OcTextHeightIcon, OcTextWidthIcon } from "@opencut/ui/icons";
import { cn } from "@/utils/ui";

export function TextProperties({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	return (
		<div className="flex h-full flex-col">
			<ContentSection element={element} trackId={trackId} />
			<TransformSection element={element} trackId={trackId} />
			<BlendingSection element={element} trackId={trackId} />
			<TypographySection element={element} trackId={trackId} />
			<SpacingSection element={element} trackId={trackId} />
			<BackgroundSection element={element} trackId={trackId} />
		</div>
	);
}

function ContentSection({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();

	const content = usePropertyDraft({
		displayValue: element.content,
		parse: (input) => input,
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { content: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="text:content" showTopBorder={false}>
			<SectionHeader>
				<SectionTitle>Content</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<Textarea
					placeholder="Name"
					value={content.displayValue}
					className="min-h-20"
					onFocus={content.onFocus}
					onChange={content.onChange}
					onBlur={content.onBlur}
				/>
			</SectionContent>
		</Section>
	);
}

function TypographySection({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});
	const resolvedTextColor = resolveColorAtTime({
		baseColor: element.color,
		animations: element.animations,
		propertyPath: "color",
		localTime,
	});

	const textColor = useKeyframedColorProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "color",
		localTime,
		isPlayheadWithinElementRange,
		resolvedColor: resolvedTextColor,
		buildBaseUpdates: ({ value }) => ({ color: value }),
	});

	const fontSize = usePropertyDraft({
		displayValue: element.fontSize.toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { fontSize: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="text:typography">
			<SectionHeader>
				<SectionTitle>Typography</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					<SectionField label="Font">
						<FontPicker
							defaultValue={element.fontFamily}
							onValueChange={(value) =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { fontFamily: value },
										},
									],
								})
							}
						/>
					</SectionField>
					<SectionField label="Size">
						<NumberField
							value={fontSize.displayValue}
							min={MIN_FONT_SIZE}
							max={MAX_FONT_SIZE}
							onFocus={fontSize.onFocus}
							onChange={fontSize.onChange}
							onBlur={fontSize.onBlur}
							onScrub={fontSize.scrubTo}
							onScrubEnd={fontSize.commitScrub}
							onReset={() =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { fontSize: DEFAULT_TEXT_ELEMENT.fontSize },
										},
									],
								})
							}
							isDefault={element.fontSize === DEFAULT_TEXT_ELEMENT.fontSize}
							icon={<HugeiconsIcon icon={TextFontIcon} />}
						/>
					</SectionField>
					<SectionField
						label="Color"
						beforeLabel={
							<KeyframeToggle
								isActive={textColor.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle text color keyframe"
								onToggle={textColor.toggleKeyframe}
							/>
						}
					>
						<ColorPicker
							value={uppercase({
								string: resolvedTextColor.replace("#", ""),
							})}
							onChange={(color) => textColor.onChange({ color: `#${color}` })}
							onChangeEnd={textColor.onChangeEnd}
						/>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

function SpacingSection({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();

	const letterSpacing = usePropertyDraft({
		displayValue: Math.round(
			element.letterSpacing ?? DEFAULT_LETTER_SPACING,
		).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { letterSpacing: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const lineHeight = usePropertyDraft({
		displayValue: (element.lineHeight ?? DEFAULT_LINE_HEIGHT).toFixed(1),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed)
				? null
				: Math.max(0.1, Math.round(parsed * 10) / 10);
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { lineHeight: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="text:spacing" showBottomBorder={false}>
			<SectionHeader>
				<SectionTitle>Spacing</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<div className="flex items-start gap-2">
					<SectionField label="Letter spacing" className="w-1/2">
						<NumberField
							value={letterSpacing.displayValue}
							onFocus={letterSpacing.onFocus}
							onChange={letterSpacing.onChange}
							onBlur={letterSpacing.onBlur}
							onScrub={letterSpacing.scrubTo}
							onScrubEnd={letterSpacing.commitScrub}
							onReset={() =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { letterSpacing: DEFAULT_LETTER_SPACING },
										},
									],
								})
							}
							isDefault={
								(element.letterSpacing ?? DEFAULT_LETTER_SPACING) ===
								DEFAULT_LETTER_SPACING
							}
							icon={<OcTextWidthIcon size={14} />}
						/>
					</SectionField>
					<SectionField label="Line height" className="w-1/2">
						<NumberField
							value={lineHeight.displayValue}
							onFocus={lineHeight.onFocus}
							onChange={lineHeight.onChange}
							onBlur={lineHeight.onBlur}
							onScrub={lineHeight.scrubTo}
							onScrubEnd={lineHeight.commitScrub}
							onReset={() =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { lineHeight: DEFAULT_LINE_HEIGHT },
										},
									],
								})
							}
							isDefault={
								(element.lineHeight ?? DEFAULT_LINE_HEIGHT) ===
								DEFAULT_LINE_HEIGHT
							}
							icon={<OcTextHeightIcon size={14} />}
						/>
					</SectionField>
				</div>
			</SectionContent>
		</Section>
	);
}

function BackgroundSection({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const lastSelectedColor = useRef(DEFAULT_COLOR);
	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});
	const resolvedBgColor = resolveColorAtTime({
		baseColor: element.background.color,
		animations: element.animations,
		propertyPath: "background.color",
		localTime,
	});

	const bgColor = useKeyframedColorProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.color",
		localTime,
		isPlayheadWithinElementRange,
		resolvedColor: resolvedBgColor,
		buildBaseUpdates: ({ value }) => ({
			background: { ...element.background, color: value },
		}),
	});

	const bg = element.background;

	const resolvedPaddingX = resolveNumberAtTime({
		baseValue: bg.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
		animations: element.animations,
		propertyPath: "background.paddingX",
		localTime,
	});
	const resolvedPaddingY = resolveNumberAtTime({
		baseValue: bg.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY,
		animations: element.animations,
		propertyPath: "background.paddingY",
		localTime,
	});
	const resolvedOffsetX = resolveNumberAtTime({
		baseValue: bg.offsetX ?? DEFAULT_TEXT_BACKGROUND.offsetX,
		animations: element.animations,
		propertyPath: "background.offsetX",
		localTime,
	});
	const resolvedOffsetY = resolveNumberAtTime({
		baseValue: bg.offsetY ?? DEFAULT_TEXT_BACKGROUND.offsetY,
		animations: element.animations,
		propertyPath: "background.offsetY",
		localTime,
	});
	const resolvedCornerRadius = resolveNumberAtTime({
		baseValue: bg.cornerRadius ?? CORNER_RADIUS_MIN,
		animations: element.animations,
		propertyPath: "background.cornerRadius",
		localTime,
	});

	const paddingX = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.paddingX",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedPaddingX).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
		},
		valueAtPlayhead: resolvedPaddingX,
		buildBaseUpdates: ({ value }) => ({
			background: { ...bg, paddingX: value },
		}),
	});

	const paddingY = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.paddingY",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedPaddingY).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
		},
		valueAtPlayhead: resolvedPaddingY,
		buildBaseUpdates: ({ value }) => ({
			background: { ...bg, paddingY: value },
		}),
	});

	const offsetX = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.offsetX",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedOffsetX).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		valueAtPlayhead: resolvedOffsetX,
		buildBaseUpdates: ({ value }) => ({
			background: { ...bg, offsetX: value },
		}),
	});

	const offsetY = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.offsetY",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedOffsetY).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		valueAtPlayhead: resolvedOffsetY,
		buildBaseUpdates: ({ value }) => ({
			background: { ...bg, offsetY: value },
		}),
	});

	const cornerRadius = useKeyframedNumberProperty({
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: "background.cornerRadius",
		localTime,
		isPlayheadWithinElementRange,
		displayValue: Math.round(resolvedCornerRadius).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: Math.round(parsed), min: CORNER_RADIUS_MIN, max: CORNER_RADIUS_MAX });
		},
		valueAtPlayhead: resolvedCornerRadius,
		buildBaseUpdates: ({ value }) => ({
			background: { ...bg, cornerRadius: value },
		}),
	});

	const toggleBackgroundEnabled = () => {
		const enabled = !element.background.enabled;
		const color =
			enabled && element.background.color === "transparent"
				? lastSelectedColor.current
				: element.background.color;
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						background: {
							...element.background,
							enabled,
							color,
						},
					},
				},
			],
		});
	};

	return (
		<Section
			collapsible
			defaultOpen={element.background.enabled}
			sectionKey="text:background"
		>
			<SectionHeader
				trailing={
					<Button
						variant="ghost"
						size="icon"
						onClick={(event) => {
							event.stopPropagation();
							toggleBackgroundEnabled();
						}}
					>
						<HugeiconsIcon
							icon={element.background.enabled ? ViewIcon : ViewOffSlashIcon}
						/>
					</Button>
				}
			>
				<SectionTitle>Background</SectionTitle>
			</SectionHeader>
			<SectionContent
				className={cn(
					!element.background.enabled && "pointer-events-none opacity-50",
				)}
			>
				<SectionFields>
					<SectionField
						label="Color"
						beforeLabel={
							<KeyframeToggle
								isActive={bgColor.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle background color keyframe"
								onToggle={bgColor.toggleKeyframe}
							/>
						}
					>
						<ColorPicker
							value={
								!element.background.enabled ||
								element.background.color === "transparent"
									? lastSelectedColor.current.replace("#", "")
									: resolvedBgColor.replace("#", "")
							}
							onChange={(color) => {
								const hexColor = `#${color}`;
								if (color !== "transparent") {
									lastSelectedColor.current = hexColor;
								}
								bgColor.onChange({ color: hexColor });
							}}
							onChangeEnd={bgColor.onChangeEnd}
						/>
					</SectionField>
					<div className="flex items-start gap-2">
						<SectionField
							label="Width"
							className="w-1/2"
							beforeLabel={
								<KeyframeToggle
									isActive={paddingX.isKeyframedAtTime}
									isDisabled={!isPlayheadWithinElementRange}
									title="Toggle background width keyframe"
									onToggle={paddingX.toggleKeyframe}
								/>
							}
						>
							<NumberField
								icon="W"
								value={paddingX.displayValue}
								min={0}
								onFocus={paddingX.onFocus}
								onChange={paddingX.onChange}
								onBlur={paddingX.onBlur}
								onScrub={paddingX.scrubTo}
								onScrubEnd={paddingX.commitScrub}
								onReset={() => paddingX.commitValue({ value: DEFAULT_TEXT_BACKGROUND.paddingX })}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: paddingX.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedPaddingX,
									staticValue: bg.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
									defaultValue: DEFAULT_TEXT_BACKGROUND.paddingX,
								})}
							/>
						</SectionField>
						<SectionField
							label="Height"
							className="w-1/2"
							beforeLabel={
								<KeyframeToggle
									isActive={paddingY.isKeyframedAtTime}
									isDisabled={!isPlayheadWithinElementRange}
									title="Toggle background height keyframe"
									onToggle={paddingY.toggleKeyframe}
								/>
							}
						>
							<NumberField
								icon="H"
								value={paddingY.displayValue}
								min={0}
								onFocus={paddingY.onFocus}
								onChange={paddingY.onChange}
								onBlur={paddingY.onBlur}
								onScrub={paddingY.scrubTo}
								onScrubEnd={paddingY.commitScrub}
								onReset={() => paddingY.commitValue({ value: DEFAULT_TEXT_BACKGROUND.paddingY })}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: paddingY.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedPaddingY,
									staticValue: bg.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY,
									defaultValue: DEFAULT_TEXT_BACKGROUND.paddingY,
								})}
							/>
						</SectionField>
					</div>
					<div className="flex items-start gap-2">
						<SectionField
							label="X-offset"
							className="w-1/2"
							beforeLabel={
								<KeyframeToggle
									isActive={offsetX.isKeyframedAtTime}
									isDisabled={!isPlayheadWithinElementRange}
									title="Toggle x-offset keyframe"
									onToggle={offsetX.toggleKeyframe}
								/>
							}
						>
							<NumberField
								icon="X"
								value={offsetX.displayValue}
								onFocus={offsetX.onFocus}
								onChange={offsetX.onChange}
								onBlur={offsetX.onBlur}
								onScrub={offsetX.scrubTo}
								onScrubEnd={offsetX.commitScrub}
								onReset={() => offsetX.commitValue({ value: DEFAULT_TEXT_BACKGROUND.offsetX })}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: offsetX.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedOffsetX,
									staticValue: bg.offsetX ?? DEFAULT_TEXT_BACKGROUND.offsetX,
									defaultValue: DEFAULT_TEXT_BACKGROUND.offsetX,
								})}
							/>
						</SectionField>
						<SectionField
							label="Y-offset"
							className="w-1/2"
							beforeLabel={
								<KeyframeToggle
									isActive={offsetY.isKeyframedAtTime}
									isDisabled={!isPlayheadWithinElementRange}
									title="Toggle y-offset keyframe"
									onToggle={offsetY.toggleKeyframe}
								/>
							}
						>
							<NumberField
								icon="Y"
								value={offsetY.displayValue}
								onFocus={offsetY.onFocus}
								onChange={offsetY.onChange}
								onBlur={offsetY.onBlur}
								onScrub={offsetY.scrubTo}
								onScrubEnd={offsetY.commitScrub}
								onReset={() => offsetY.commitValue({ value: DEFAULT_TEXT_BACKGROUND.offsetY })}
								isDefault={isPropertyAtDefault({
									hasAnimatedKeyframes: offsetY.hasAnimatedKeyframes,
									isPlayheadWithinElementRange,
									resolvedValue: resolvedOffsetY,
									staticValue: bg.offsetY ?? DEFAULT_TEXT_BACKGROUND.offsetY,
									defaultValue: DEFAULT_TEXT_BACKGROUND.offsetY,
								})}
							/>
						</SectionField>
					</div>
					<SectionField
						label="Corner radius"
						beforeLabel={
							<KeyframeToggle
								isActive={cornerRadius.isKeyframedAtTime}
								isDisabled={!isPlayheadWithinElementRange}
								title="Toggle corner radius keyframe"
								onToggle={cornerRadius.toggleKeyframe}
							/>
						}
					>
						<NumberField
							icon="R"
							value={cornerRadius.displayValue}
							min={CORNER_RADIUS_MIN}
							max={CORNER_RADIUS_MAX}
							onFocus={cornerRadius.onFocus}
							onChange={cornerRadius.onChange}
							onBlur={cornerRadius.onBlur}
							onScrub={cornerRadius.scrubTo}
							onScrubEnd={cornerRadius.commitScrub}
							onReset={() => cornerRadius.commitValue({ value: CORNER_RADIUS_MIN })}
							isDefault={isPropertyAtDefault({
								hasAnimatedKeyframes: cornerRadius.hasAnimatedKeyframes,
								isPlayheadWithinElementRange,
								resolvedValue: resolvedCornerRadius,
								staticValue: bg.cornerRadius ?? CORNER_RADIUS_MIN,
								defaultValue: CORNER_RADIUS_MIN,
							})}
						/>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
