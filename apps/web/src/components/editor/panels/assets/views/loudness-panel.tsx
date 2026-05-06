"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon } from "@hugeicons/core-free-icons";
import { useLoudnessNormalization } from "@/hooks/use-loudness-normalization";
import { LOUDNESS_PRESETS, DEFAULT_NORMALIZATION, type NormalizationConfig } from "@/lib/audio/loudness-types";

export function LoudnessPanel({ className }: { className?: string }) {
	const { analyze, normalize, measurement } = useLoudnessNormalization();
	const [config, setConfig] = useState<NormalizationConfig>(DEFAULT_NORMALIZATION);
	const [targetLufs, setTargetLufs] = useState(-14);

	const selectedPreset = LOUDNESS_PRESETS.find((p) => p.targetLUFS === targetLufs);

	const handleNormalize = useCallback(() => {
		normalize({ ...config, targetLUFS: targetLufs });
	}, [normalize, config, targetLufs]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={VolumeHighIcon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Loudness Normalization</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Measure and normalize audio to broadcast loudness standards.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1 overflow-y-auto">
				{measurement && (
					<div className="rounded border p-2 space-y-1.5">
						<span className="text-[10px] font-medium">Current Measurement</span>
						<div className="grid grid-cols-2 gap-1 text-[9px]">
							<div>
								<span className="text-muted-foreground">Integrated: </span>
								<span className="font-mono">{measurement.integrated} LUFS</span>
							</div>
							<div>
								<span className="text-muted-foreground">True Peak: </span>
								<span className="font-mono">{measurement.truePeak} dBTP</span>
							</div>
							<div>
								<span className="text-muted-foreground">Short Term: </span>
								<span className="font-mono">{measurement.shortTerm} LUFS</span>
							</div>
							<div>
								<span className="text-muted-foreground">Range: </span>
								<span className="font-mono">{measurement.range} LU</span>
							</div>
						</div>
					</div>
				)}

				<Button
					variant="outline"
					className="w-full h-7 text-[10px]"
					onClick={analyze}
				>
					{measurement ? "Re-analyze" : "Analyze Loudness"}
				</Button>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Target Preset</span>
					<div className="grid grid-cols-2 gap-1">
						{LOUDNESS_PRESETS.map((preset) => (
							<button
								key={preset.label}
								type="button"
								className={cn(
									"rounded border p-1.5 text-left transition-colors",
									targetLufs === preset.targetLUFS
										? "border-primary bg-primary/5"
										: "hover:bg-accent/50",
								)}
								onClick={() => {
									setTargetLufs(preset.targetLUFS);
									setConfig((c) => ({
										...c,
										targetLUFS: preset.targetLUFS,
										truePeakLimit: preset.truePeakLimit,
									}));
								}}
							>
								<span className="text-[9px] font-medium block">{preset.label}</span>
								<span className="text-[7px] text-muted-foreground">
									{preset.targetLUFS} LUFS
								</span>
							</button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<div className="flex justify-between text-[10px] text-muted-foreground">
						<span>Target LUFS</span>
						<span className="font-mono">{targetLufs} LUFS</span>
					</div>
					<Slider
						value={[targetLufs]}
						onValueChange={([v]) => {
							setTargetLufs(v);
							setConfig((c) => ({ ...c, targetLUFS: v }));
						}}
						min={-30}
						max={0}
						step={0.5}
					/>
				</div>

				<Button
					className="w-full"
					onClick={handleNormalize}
					disabled={!measurement}
				>
					Normalize to {targetLufs} LUFS
				</Button>

				{measurement && (
					<div className="text-[9px] text-muted-foreground text-center">
						Gain adjustment:{" "}
						<span className="font-mono">
							{targetLufs - measurement.integrated > 0 ? "+" : ""}
							{Math.round((targetLufs - measurement.integrated) * 100) / 100} dB
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
