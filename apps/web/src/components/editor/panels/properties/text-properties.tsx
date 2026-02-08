import { Textarea } from "@/components/ui/textarea";
import { FontPicker } from "@/components/ui/font-picker";
import type { FontFamily } from "@/constants/font-constants";
import type { TextElement } from "@/types/timeline";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { PanelBaseView } from "@/components/editor/panels/panel-base-view";
import {
	TEXT_PROPERTIES_TABS,
	isTextPropertiesTab,
	useTextPropertiesStore,
} from "@/stores/text-properties-store";
import {
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/utils/ui";
import { capitalizeFirstLetter, uppercase } from "@/utils/string";
import { clamp } from "@/utils/math";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutGridIcon } from "@hugeicons/core-free-icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_COLOR } from "@/constants/project-constants";
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from "@/constants/text-constants";

export function TextProperties({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const { activeTab, setActiveTab } = useTextPropertiesStore();
	const containerRef = useRef<HTMLDivElement>(null);
	const [fontSizeInput, setFontSizeInput] = useState(
		element.fontSize.toString(),
	);
	const [opacityInput, setOpacityInput] = useState(
		Math.round(element.opacity * 100).toString(),
	);

	const lastSelectedColor = useRef(DEFAULT_COLOR);
	const initialFontSizeRef = useRef<number | null>(null);
	const initialOpacityRef = useRef<number | null>(null);

	const handleFontSizeChange = ({ value }: { value: string }) => {
		setFontSizeInput(value);

		if (value.trim() !== "") {
			const parsed = parseInt(value, 10);
			const fontSize = Number.isNaN(parsed)
				? element.fontSize
				: clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
			editor.timeline.updateElements({
				updates: [{ trackId, elementId: element.id, updates: { fontSize } }],
			});
		}
	};

	const handleFontSizeBlur = () => {
		const parsed = parseInt(fontSizeInput, 10);
		const fontSize = Number.isNaN(parsed)
			? element.fontSize
			: clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
		setFontSizeInput(fontSize.toString());
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, updates: { fontSize } }],
		});
	};

	const handleOpacityChange = ({ value }: { value: string }) => {
		setOpacityInput(value);

		if (value.trim() !== "") {
			const parsed = parseInt(value, 10);
			const opacityPercent = Number.isNaN(parsed)
				? Math.round(element.opacity * 100)
				: clamp({ value: parsed, min: 0, max: 100 });
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { opacity: opacityPercent / 100 },
					},
				],
			});
		}
	};

	const handleOpacityBlur = () => {
		const parsed = parseInt(opacityInput, 10);
		const opacityPercent = Number.isNaN(parsed)
			? Math.round(element.opacity * 100)
			: clamp({ value: parsed, min: 0, max: 100 });
		setOpacityInput(opacityPercent.toString());
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { opacity: opacityPercent / 100 },
				},
			],
		});
	};

	const handleColorChange = ({ color }: { color: string }) => {
		if (color !== "transparent") {
			lastSelectedColor.current = color;
		}
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { backgroundColor: color },
				},
			],
		});
	};

	const handleTransparentToggle = ({
		isTransparent,
	}: {
		isTransparent: boolean;
	}) => {
		const newColor = isTransparent ? "transparent" : lastSelectedColor.current;
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { backgroundColor: newColor },
				},
			],
		});
	};

	return (
		<PanelBaseView
			defaultTab="transform"
			value={activeTab}
			onValueChange={(v) => {
				if (isTextPropertiesTab(v)) setActiveTab(v);
			}}
			ref={containerRef}
			tabs={TEXT_PROPERTIES_TABS.map((t) => ({
				value: t.value,
				label: t.label,
				content:
					t.value === "transform" ? (
						<div className="space-y-6"></div>
					) : (
						<div className="space-y-6">
							<Textarea
								placeholder="Name"
								defaultValue={element.content}
								className="bg-panel-accent min-h-20"
								onChange={(e) =>
									editor.timeline.updateElements({
										updates: [
											{
												trackId,
												elementId: element.id,
												updates: { content: e.target.value },
											},
										],
									})
								}
							/>
							<PropertyItem direction="column">
								<PropertyItemLabel>Font</PropertyItemLabel>
								<PropertyItemValue>
									<FontPicker
										defaultValue={element.fontFamily}
										onValueChange={(value: FontFamily) =>
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
								</PropertyItemValue>
							</PropertyItem>
							<PropertyItem direction="column">
								<PropertyItemLabel>Style</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex items-center gap-2">
										<Button
											variant={
												element.fontWeight === "bold" ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: {
																fontWeight:
																	element.fontWeight === "bold"
																		? "normal"
																		: "bold",
															},
														},
													],
												})
											}
											className="h-8 px-3 font-bold"
										>
											B
										</Button>
										<Button
											variant={
												element.fontStyle === "italic" ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: {
																fontStyle:
																	element.fontStyle === "italic"
																		? "normal"
																		: "italic",
															},
														},
													],
												})
											}
											className="h-8 px-3 italic"
										>
											I
										</Button>
										<Button
											variant={
												element.textDecoration === "underline"
													? "default"
													: "outline"
											}
											size="sm"
											onClick={() =>
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: {
																textDecoration:
																	element.textDecoration === "underline"
																		? "none"
																		: "underline",
															},
														},
													],
												})
											}
											className="h-8 px-3 underline"
										>
											U
										</Button>
										<Button
											variant={
												element.textDecoration === "line-through"
													? "default"
													: "outline"
											}
											size="sm"
											onClick={() =>
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: {
																textDecoration:
																	element.textDecoration === "line-through"
																		? "none"
																		: "line-through",
															},
														},
													],
												})
											}
											className="h-8 px-3 line-through"
										>
											S
										</Button>
									</div>
								</PropertyItemValue>
							</PropertyItem>
							<PropertyItem direction="column">
								<PropertyItemLabel>Font size</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex items-center gap-2">
										<Slider
											value={[element.fontSize]}
											min={MIN_FONT_SIZE}
											max={MAX_FONT_SIZE}
											step={1}
											onValueChange={([value]) => {
												if (initialFontSizeRef.current === null) {
													initialFontSizeRef.current = element.fontSize;
												}
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: { fontSize: value },
														},
													],
													pushHistory: false,
												});
												setFontSizeInput(value.toString());
											}}
											onValueCommit={([value]) => {
												if (initialFontSizeRef.current !== null) {
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: {
																	fontSize: initialFontSizeRef.current,
																},
															},
														],
														pushHistory: false,
													});
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { fontSize: value },
															},
														],
														pushHistory: true,
													});
													initialFontSizeRef.current = null;
												}
											}}
											className="w-full"
										/>
										<Input
											type="number"
											value={fontSizeInput}
											min={MIN_FONT_SIZE}
											max={MAX_FONT_SIZE}
											onChange={(e) =>
												handleFontSizeChange({ value: e.target.value })
											}
											onBlur={handleFontSizeBlur}
											className="bg-panel-accent h-7 w-12 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										/>
									</div>
								</PropertyItemValue>
							</PropertyItem>
							<PropertyItem direction="column">
								<PropertyItemLabel>Color</PropertyItemLabel>
								<PropertyItemValue>
									<ColorPicker
										value={uppercase({
											string: (element.color || "FFFFFF").replace("#", ""),
										})}
										onChange={(color) => {
											editor.timeline.updateElements({
												updates: [
													{
														trackId,
														elementId: element.id,
														updates: { color: `#${color}` },
													},
												],
											});
										}}
										containerRef={containerRef}
									/>
								</PropertyItemValue>
							</PropertyItem>
							<PropertyItem direction="column">
								<PropertyItemLabel>Opacity</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex items-center gap-2">
										<Slider
											value={[element.opacity * 100]}
											min={0}
											max={100}
											step={1}
											onValueChange={([value]) => {
												if (initialOpacityRef.current === null) {
													initialOpacityRef.current = element.opacity;
												}
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: { opacity: value / 100 },
														},
													],
													pushHistory: false,
												});
												setOpacityInput(value.toString());
											}}
											onValueCommit={([value]) => {
												if (initialOpacityRef.current !== null) {
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: initialOpacityRef.current },
															},
														],
														pushHistory: false,
													});
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: value / 100 },
															},
														],
														pushHistory: true,
													});
													initialOpacityRef.current = null;
												}
											}}
											className="w-full"
										/>
										<Input
											type="number"
											value={opacityInput}
											min={0}
											max={100}
											onChange={(e) =>
												handleOpacityChange({ value: e.target.value })
											}
											onBlur={handleOpacityBlur}
											className="bg-panel-accent h-7 w-12 [appearance:textfield] rounded-sm text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										/>
									</div>
								</PropertyItemValue>
							</PropertyItem>
							<PropertyItem direction="column">
								<PropertyItemLabel>Background</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex items-center gap-2">
										<ColorPicker
											value={capitalizeFirstLetter({
												string:
													element.backgroundColor === "transparent"
														? lastSelectedColor.current.replace("#", "")
														: element.backgroundColor.replace("#", ""),
											})}
											onChange={(color) =>
												handleColorChange({ color: `#${color}` })
											}
											containerRef={containerRef}
											className={
												element.backgroundColor === "transparent"
													? "pointer-events-none opacity-50"
													: ""
											}
										/>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="icon"
													onClick={() =>
														handleTransparentToggle({
															isTransparent:
																element.backgroundColor !== "transparent",
														})
													}
													className="bg-panel-accent size-9 overflow-hidden rounded-full p-0"
												>
													<HugeiconsIcon
														icon={LayoutGridIcon}
														className={cn(
															"text-foreground",
															element.backgroundColor === "transparent" &&
																"text-primary",
														)}
													/>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Transparent background</TooltipContent>
										</Tooltip>
									</div>
								</PropertyItemValue>
							</PropertyItem>
						</div>
					),
			}))}
		/>
	);
}
