"use client";

import type { EffectParamDefinition, NumberEffectParamDefinition } from "@/types/effects";
import { clamp } from "@/utils/math";
import { SectionField } from "./section";
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePropertyDraft } from "./hooks/use-property-draft";

export function EffectParamField({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: EffectParamDefinition;
	value: number | string | boolean;
	onPreview: (value: number | string | boolean) => void;
	onCommit: () => void;
}) {
	return (
		<SectionField label={param.label}>
			<EffectParamInput param={param} value={value} onPreview={onPreview} onCommit={onCommit} />
		</SectionField>
	);
}

function EffectParamInput({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: EffectParamDefinition;
	value: number | string | boolean;
	onPreview: (value: number | string | boolean) => void;
	onCommit: () => void;
}) {
	if (param.type === "number") {
		return (
			<NumberParamField
				param={param}
				value={typeof value === "number" ? value : Number(value)}
				onPreview={onPreview}
				onCommit={onCommit}
			/>
		);
	}

	if (param.type === "boolean") {
		return (
			<Switch
				checked={Boolean(value)}
				onCheckedChange={(checked) => {
					onPreview(checked);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "select") {
		return (
			<Select
				value={String(value)}
				onValueChange={(selected) => {
					onPreview(selected);
					onCommit();
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{param.options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	if (param.type === "color") {
		return (
			<input
				type="color"
				className="h-8 w-full cursor-pointer rounded border"
				value={String(value)}
				onChange={(event) => onPreview(event.target.value)}
				onBlur={onCommit}
			/>
		);
	}

	return null;
}

function NumberParamField({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: NumberEffectParamDefinition;
	value: number;
	onPreview: (value: number) => void;
	onCommit: () => void;
}) {
	const { min, max, step } = param;

	const draft = usePropertyDraft({
		displayValue: String(value),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min, max });
		},
		onPreview,
		onCommit,
	});

	return (
		<div className="flex items-center gap-3">
			<Slider
				className="flex-1"
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={([newValue]) => onPreview(newValue)}
				onValueCommit={onCommit}
			/>
			<NumberField
				className="w-16 shrink-0"
				value={draft.displayValue}
				onFocus={draft.onFocus}
				onChange={draft.onChange}
				onBlur={draft.onBlur}
			/>
		</div>
	);
}
