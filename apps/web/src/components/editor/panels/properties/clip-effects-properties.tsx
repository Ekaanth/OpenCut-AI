"use client";

import { useEffect, useState } from "react";
import type { Effect } from "@/types/effects";
import type { VisualElement } from "@/types/timeline";
import { getEffect } from "@/lib/effects/registry";
import { useEditor } from "@/hooks/use-editor";
import { usePropertiesStore } from "@/stores/properties-store";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
	SectionFields,
} from "./section";
import { EffectParamField } from "./effect-param-field";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowLeft01Icon,
	Delete02Icon,
	ViewIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/utils/ui";
export function ClipEffectsProperties({
	element,
	trackId,
}: {
	element: VisualElement;
	trackId: string;
}) {
	const closeClipEffects = usePropertiesStore(
		(state) => state.closeClipEffects,
	);
	const editor = useEditor();
	const effects = element.effects ?? [];

	useEffect(() => {
		if (effects.length === 0) closeClipEffects();
	}, [effects.length, closeClipEffects]);

	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);

	const handleDragStart = ({ index }: { index: number }) => {
		setDragIndex(index);
	};

	const handleDragOver = ({ event, index }: { event: React.DragEvent; index: number }) => {
		event.preventDefault();
		if (index !== dropIndex) setDropIndex(index);
	};

	const handleDrop = ({ toIndex }: { toIndex: number }) => {
		if (dragIndex !== null && dragIndex !== toIndex) {
			editor.timeline.reorderClipEffects({
				trackId,
				elementId: element.id,
				fromIndex: dragIndex,
				toIndex,
			});
		}
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex h-11 shrink-0 items-center gap-2 border-b px-1.5">
				<Button
					variant="ghost"
					size="icon"
					onClick={closeClipEffects}
					aria-label="Back to properties"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} />
				</Button>
				<span className="text-sm font-medium">Effects</span>
			</div>
			<ScrollArea className="flex-1 scrollbar-hidden">
				{effects.map((effect, index) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop list reorder
					<div
						key={effect.id}
						draggable
					onDragStart={() => handleDragStart({ index })}
					onDragOver={(event) => handleDragOver({ event, index })}
					onDrop={() => handleDrop({ toIndex: index })}
						onDragEnd={handleDragEnd}
						className={cn(
							"group",
							dragIndex === index && "opacity-40",
							dropIndex === index &&
								dragIndex !== null &&
								dragIndex !== index &&
								(index < dragIndex
									? "border-t-2 border-primary"
									: "border-b-2 border-primary"),
						)}
					>
						<ClipEffectSection
							effect={effect}
							element={element}
							trackId={trackId}
						/>
					</div>
				))}
			</ScrollArea>
		</div>
	);
}

function ClipEffectSection({
	effect,
	element,
	trackId,
}: {
	effect: Effect;
	element: VisualElement;
	trackId: string;
}) {
	const editor = useEditor();
	const definition = getEffect({ effectType: effect.type });

	const previewParam = ({ key }: { key: string }) => (value: number | string | boolean) => {
		const updatedEffects = (element.effects ?? []).map((existing) =>
			existing.id !== effect.id
				? existing
				: { ...existing, params: { ...existing.params, [key]: value } },
		);
		editor.timeline.previewElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { effects: updatedEffects },
				},
			],
		});
	};

	const commitParam = () => editor.timeline.commitPreview();

	const toggleEffect = () =>
		editor.timeline.toggleClipEffect({
			trackId,
			elementId: element.id,
			effectId: effect.id,
		});

	const removeEffect = () =>
		editor.timeline.removeClipEffect({
			trackId,
			elementId: element.id,
			effectId: effect.id,
		});

	return (
		<Section sectionKey={`clip-effect:${effect.id}`} showTopBorder={false}>
			<SectionHeader
				className="cursor-move"
				trailing={
					<div className="flex items-center gap-1">
						<Button
							variant={effect.enabled ? "secondary" : "ghost"}
							size="icon"
							aria-label={`Toggle ${definition.name}`}
							onClick={toggleEffect}
						>
							<HugeiconsIcon
								icon={effect.enabled ? ViewIcon : ViewOffSlashIcon}
							/>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Remove ${definition.name}`}
							onClick={removeEffect}
						>
							<HugeiconsIcon icon={Delete02Icon} />
						</Button>
					</div>
				}
			>
				<SectionTitle
					className={cn(!effect.enabled && "text-muted-foreground")}
				>
					{definition.name}
				</SectionTitle>
			</SectionHeader>
			{effect.enabled && (
				<SectionContent>
					<SectionFields>
						{definition.params.map((param) => (
							<EffectParamField
								key={param.key}
								param={param}
								value={effect.params[param.key] ?? param.default}
								onPreview={previewParam({ key: param.key })}
								onCommit={commitParam}
							/>
						))}
					</SectionFields>
				</SectionContent>
			)}
		</Section>
	);
}
