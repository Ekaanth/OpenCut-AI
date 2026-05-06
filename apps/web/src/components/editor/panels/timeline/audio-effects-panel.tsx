"use client";

import { useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { getAllAudioEffectDefinitions, type AudioEffectType } from "@/lib/audio/audio-effects";

interface TrackAudioEffect {
	id: string;
	type: AudioEffectType;
	params: Record<string, number>;
	enabled: boolean;
}

interface AudioEffectsChainProps {
	trackId: string;
	trackType: "audio" | "video";
	className?: string;
}

export function AudioEffectsChainPanel({ trackId, trackType, className }: AudioEffectsChainProps) {
	const editor = useEditor();
	const track = editor.timeline.getTrackById({ trackId });
	if (!track || (trackType !== "audio" && trackType !== "video")) return null;

	const effects: TrackAudioEffect[] = (track as any).audioEffects ?? [];

	const handleAdd = useCallback(
		(type: AudioEffectType) => {
			const def = getAllAudioEffectDefinitions().find((d) => d.type === type);
			if (!def) return;
			const params: Record<string, number> = {};
			for (const p of def.params) {
				params[p.key] = p.default;
			}
			const updatedEffects = [
				...effects,
				{ id: `afx-${Date.now()}`, type, params, enabled: true },
			];
			editor.timeline.updateTrack({
				trackId,
				updates: { audioEffects: updatedEffects } as any,
			});
		},
		[effects, trackId, editor],
	);

	const handleRemove = useCallback(
		(effectId: string) => {
			const updatedEffects = effects.filter((e) => e.id !== effectId);
			editor.timeline.updateTrack({
				trackId,
				updates: { audioEffects: updatedEffects } as any,
			});
		},
		[effects, trackId, editor],
	);

	const handleParamChange = useCallback(
		(effectId: string, key: string, value: number) => {
			const updatedEffects = effects.map((e) =>
				e.id === effectId ? { ...e, params: { ...e.params, [key]: value } } : e,
			);
			editor.timeline.updateTrack({
				trackId,
				updates: { audioEffects: updatedEffects } as any,
			});
		},
		[effects, trackId, editor],
	);

	const handleToggle = useCallback(
		(effectId: string) => {
			const updatedEffects = effects.map((e) =>
				e.id === effectId ? { ...e, enabled: !e.enabled } : e,
			);
			editor.timeline.updateTrack({
				trackId,
				updates: { audioEffects: updatedEffects } as any,
			});
		},
		[effects, trackId, editor],
	);

	const availableEffects = getAllAudioEffectDefinitions();

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Audio Effects</span>
			</div>

			{effects.map((effect) => {
				const def = availableEffects.find((d) => d.type === effect.type);
				if (!def) return null;
				return (
					<div
						key={effect.id}
						className={cn(
							"rounded border p-2 space-y-2",
							!effect.enabled && "opacity-50",
						)}
					>
						<div className="flex items-center gap-2">
							<button
								type="button"
								className={cn(
									"size-3 rounded-full border-2",
									effect.enabled ? "bg-primary border-primary" : "bg-transparent border-muted-foreground",
								)}
								onClick={() => handleToggle(effect.id)}
							/>
							<span className="text-[11px] font-medium flex-1">{def.name}</span>
							<button
								type="button"
								onClick={() => handleRemove(effect.id)}
								className="text-muted-foreground hover:text-destructive"
							>
								<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
							</button>
						</div>
						{def.params.map((param) => (
							<div key={param.key} className="space-y-0.5">
								<div className="flex justify-between text-[9px] text-muted-foreground">
									<span>{param.label}</span>
									<span className="font-mono">
										{effect.params[param.key]?.toFixed(param.step < 1 ? 1 : 0)}
										{param.unit ? ` ${param.unit}` : ""}
									</span>
								</div>
								<Slider
									value={[effect.params[param.key] ?? param.default]}
									onValueChange={([v]) => handleParamChange(effect.id, param.key, v)}
									min={param.min}
									max={param.max}
									step={param.step}
								/>
							</div>
						))}
					</div>
				);
			})}

			<div className="flex flex-wrap gap-1">
				{availableEffects
					.filter((def) => !effects.some((e) => e.type === def.type))
					.map((def) => (
						<Button
							key={def.type}
							variant="outline"
							size="sm"
							className="h-6 text-[9px]"
							onClick={() => handleAdd(def.type)}
						>
							<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
							{def.name}
						</Button>
					))}
			</div>
		</div>
	);
}
