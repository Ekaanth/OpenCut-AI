import { Textarea } from "@/components/ui/textarea";
import { FontPicker } from "@/components/ui/font-picker";
import type { TextElement } from "@/types/timeline";
import { NumberField } from "@/components/ui/number-field";
import { useRef } from "react";
import { Section, SectionContent, SectionField, SectionFields, SectionHeader } from "./section";
import { ColorPicker } from "@/components/ui/color-picker";
import { uppercase } from "@/utils/string";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_COLOR } from "@/constants/project-constants";
import {
	DEFAULT_LETTER_SPACING,
	DEFAULT_LINE_HEIGHT,
	DEFAULT_TEXT_BACKGROUND,
	DEFAULT_TEXT_ELEMENT,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "@/constants/text-constants";
import { usePropertyDraft } from "./hooks/use-property-draft";
import { TransformSection, BlendingSection } from "./sections";
import { HugeiconsIcon } from "@hugeicons/react";
import { TextFontIcon } from "@hugeicons/core-free-icons";
import { OcTextHeightIcon, OcTextWidthIcon } from "@opencut/ui/icons";

function createOffsetConverter({
	defaultValue,
	scale = 1,
	min,
}: {
	defaultValue: number;
	scale?: number;
	min?: number;
}) {
	return {
		toDisplay: (value: number) => Math.round((value - defaultValue) * scale),
		fromDisplay: (display: number) => {
			const stored = defaultValue + display / scale;
			return min !== undefined ? Math.max(min, stored) : stored;
		},
	};
}

const lineHeightConverter = createOffsetConverter({ defaultValue: DEFAULT_LINE_HEIGHT, scale: 10 });
const paddingXConverter = createOffsetConverter({ defaultValue: DEFAULT_TEXT_BACKGROUND.paddingX, min: 0 });
const paddingYConverter = createOffsetConverter({ defaultValue: DEFAULT_TEXT_BACKGROUND.paddingY, min: 0 });

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
		<Section collapsible sectionKey="text:content" hasBorderTop={false}>
			<SectionHeader title="Content" />
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
		<SectionHeader title="Typography" />
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
				<SectionField label="Color">
					<ColorPicker
						value={uppercase({
							string: (element.color || "FFFFFF").replace("#", ""),
						})}
						onChange={(color) =>
							editor.timeline.previewElements({
								updates: [
									{
										trackId,
										elementId: element.id,
										updates: { color: `#${color}` },
									},
								],
							})
						}
						onChangeEnd={() => editor.timeline.commitPreview()}
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
		displayValue: Math.round(element.letterSpacing ?? DEFAULT_LETTER_SPACING).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [{ trackId, elementId: element.id, updates: { letterSpacing: value } }],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const lineHeight = usePropertyDraft({
		displayValue: lineHeightConverter.toDisplay(element.lineHeight ?? DEFAULT_LINE_HEIGHT).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : lineHeightConverter.fromDisplay(Math.round(parsed));
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [{ trackId, elementId: element.id, updates: { lineHeight: value } }],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="text:spacing" hasBorderBottom={false}>
			<SectionHeader title="Spacing" />
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
								updates: [{ trackId, elementId: element.id, updates: { letterSpacing: DEFAULT_LETTER_SPACING } }],
							})
						}
						isDefault={(element.letterSpacing ?? DEFAULT_LETTER_SPACING) === DEFAULT_LETTER_SPACING}
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
								updates: [{ trackId, elementId: element.id, updates: { lineHeight: DEFAULT_LINE_HEIGHT } }],
							})
						}
						isDefault={(element.lineHeight ?? DEFAULT_LINE_HEIGHT) === DEFAULT_LINE_HEIGHT}
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

	const cornerRadius = usePropertyDraft({
		displayValue: Math.round(element.background.cornerRadius ?? 0).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: {
							background: { ...element.background, cornerRadius: value },
						},
					},
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const paddingX = usePropertyDraft({
		displayValue: paddingXConverter.toDisplay(element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : paddingXConverter.fromDisplay(Math.round(parsed));
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { background: { ...element.background, paddingX: value } },
					},
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const paddingY = usePropertyDraft({
		displayValue: paddingYConverter.toDisplay(element.background.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : paddingYConverter.fromDisplay(Math.round(parsed));
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { background: { ...element.background, paddingY: value } },
					},
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const offsetX = usePropertyDraft({
		displayValue: Math.round(element.background.offsetX ?? 0).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { background: { ...element.background, offsetX: value } },
					},
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	const offsetY = usePropertyDraft({
		displayValue: Math.round(element.background.offsetY ?? 0).toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			return Number.isNaN(parsed) ? null : Math.round(parsed);
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { background: { ...element.background, offsetY: value } },
					},
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="text:background">
			<SectionHeader title="Background" />
			<SectionContent>
				<SectionFields>
					<SectionField label="Color">
						<ColorPicker
							value={
								element.background.color === "transparent"
									? lastSelectedColor.current.replace("#", "")
									: element.background.color.replace("#", "")
							}
							onChange={(color) => {
								const hexColor = `#${color}`;
								if (color !== "transparent") {
									lastSelectedColor.current = hexColor;
								}
								editor.timeline.previewElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: {
												background: { ...element.background, color: hexColor },
											},
										},
									],
								});
							}}
							onChangeEnd={() => editor.timeline.commitPreview()}
							className={
								element.background.color === "transparent"
									? "pointer-events-none opacity-50"
									: ""
							}
						/>
					</SectionField>
					<div className="flex items-start gap-2">
					<SectionField label="Width" className="w-1/2">
						<NumberField
							icon="W"
							value={paddingX.displayValue}
							min={0}
								onFocus={paddingX.onFocus}
								onChange={paddingX.onChange}
								onBlur={paddingX.onBlur}
								onScrub={paddingX.scrubTo}
								onScrubEnd={paddingX.commitScrub}
								onReset={() =>
									editor.timeline.updateElements({
										updates: [
											{
												trackId,
												elementId: element.id,
												updates: {
													background: {
														...element.background,
														paddingX: DEFAULT_TEXT_BACKGROUND.paddingX,
													},
												},
											},
										],
									})
								}
								isDefault={
									(element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX) ===
									DEFAULT_TEXT_BACKGROUND.paddingX
								}
							/>
						</SectionField>
					<SectionField label="Height" className="w-1/2">
						<NumberField
							icon="H"
							value={paddingY.displayValue}
							min={0}
								onFocus={paddingY.onFocus}
								onChange={paddingY.onChange}
								onBlur={paddingY.onBlur}
								onScrub={paddingY.scrubTo}
								onScrubEnd={paddingY.commitScrub}
								onReset={() =>
									editor.timeline.updateElements({
										updates: [
											{
												trackId,
												elementId: element.id,
												updates: {
													background: {
														...element.background,
														paddingY: DEFAULT_TEXT_BACKGROUND.paddingY,
													},
												},
											},
										],
									})
								}
								isDefault={
									(element.background.paddingY ?? DEFAULT_TEXT_BACKGROUND.paddingY) ===
									DEFAULT_TEXT_BACKGROUND.paddingY
								}
							/>
						</SectionField>
					</div>
					<div className="flex items-start gap-2">
					<SectionField label="X-offset" className="w-1/2">
						<NumberField
							icon="X"
							value={offsetX.displayValue}
								onFocus={offsetX.onFocus}
								onChange={offsetX.onChange}
								onBlur={offsetX.onBlur}
								onScrub={offsetX.scrubTo}
								onScrubEnd={offsetX.commitScrub}
								onReset={() =>
									editor.timeline.updateElements({
										updates: [
											{
												trackId,
												elementId: element.id,
												updates: {
													background: { ...element.background, offsetX: 0 },
												},
											},
										],
									})
								}
								isDefault={(element.background.offsetX ?? 0) === 0}
							/>
						</SectionField>
					<SectionField label="Y-offset" className="w-1/2">
						<NumberField
							icon="Y"
							value={offsetY.displayValue}
								onFocus={offsetY.onFocus}
								onChange={offsetY.onChange}
								onBlur={offsetY.onBlur}
								onScrub={offsetY.scrubTo}
								onScrubEnd={offsetY.commitScrub}
								onReset={() =>
									editor.timeline.updateElements({
										updates: [
											{
												trackId,
												elementId: element.id,
												updates: {
													background: { ...element.background, offsetY: 0 },
												},
											},
										],
									})
								}
								isDefault={(element.background.offsetY ?? 0) === 0}
							/>
						</SectionField>
					</div>
				<SectionField label="Corner Radius">
					<NumberField
						icon="R"
						value={cornerRadius.displayValue}
						min={0}
							onFocus={cornerRadius.onFocus}
							onChange={cornerRadius.onChange}
							onBlur={cornerRadius.onBlur}
							onScrub={cornerRadius.scrubTo}
							onScrubEnd={cornerRadius.commitScrub}
							onReset={() =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: {
												background: {
													...element.background,
													cornerRadius: 0,
												},
											},
										},
									],
								})
							}
							isDefault={(element.background.cornerRadius ?? 0) === 0}
						/>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
