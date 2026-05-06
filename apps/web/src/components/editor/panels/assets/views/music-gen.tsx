"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { HugeiconsIcon } from "@hugeicons/react";
import { MusicNote01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { useMusicGen } from "@/hooks/use-music-gen";
import {
	MUSIC_GENRES,
	MUSIC_MOODS,
	MUSIC_TEMPOS,
	DEFAULT_MUSIC_PARAMS,
	type MusicGenParams,
} from "@/lib/music/music-gen-types";

export function MusicGenPanel({ className }: { className?: string }) {
	const { generate, addToTimeline, generatedUrl, generatedDuration } = useMusicGen();
	const [params, setParams] = useState<MusicGenParams>(DEFAULT_MUSIC_PARAMS);
	const [isGenerating, setIsGenerating] = useState(false);

	const handleGenerate = useCallback(async () => {
		setIsGenerating(true);
		try {
			await generate(params);
		} finally {
			setIsGenerating(false);
		}
	}, [generate, params]);

	const handleAddToTimeline = useCallback(async () => {
		if (!generatedUrl) return;
		await addToTimeline(
			generatedUrl,
			generatedDuration,
			`${params.genre} - ${params.mood}`,
		);
	}, [generatedUrl, generatedDuration, addToTimeline, params]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={MusicNote01Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">AI Music Generator</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Generate royalty-free background music for your project.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1 overflow-y-auto">
				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Description (optional)</span>
					<textarea
						className="w-full rounded border bg-transparent px-2 py-1 text-[10px] resize-none h-14 placeholder:text-muted-foreground"
						placeholder="Describe the music you want..."
						value={params.prompt}
						onChange={(e) => setParams((p) => ({ ...p, prompt: e.target.value }))}
					/>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Genre</span>
					<div className="flex flex-wrap gap-1">
						{MUSIC_GENRES.map((genre) => (
							<Button
								key={genre}
								variant={params.genre === genre ? "secondary" : "ghost"}
								size="sm"
								className="h-5 text-[8px] px-1.5"
								onClick={() => setParams((p) => ({ ...p, genre }))}
							>
								{genre}
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Mood</span>
					<div className="flex flex-wrap gap-1">
						{MUSIC_MOODS.map((mood) => (
							<Button
								key={mood}
								variant={params.mood === mood ? "secondary" : "ghost"}
								size="sm"
								className="h-5 text-[8px] px-1.5"
								onClick={() => setParams((p) => ({ ...p, mood }))}
							>
								{mood}
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Tempo</span>
					<div className="flex gap-1">
						{Object.entries(MUSIC_TEMPOS).map(([key, val]) => (
							<Button
								key={key}
								variant={params.tempo === key ? "secondary" : "ghost"}
								size="sm"
								className="flex-1 h-7 text-[9px]"
								onClick={() =>
									setParams((p) => ({ ...p, tempo: key as MusicGenParams["tempo"] }))
								}
							>
								<div className="flex flex-col">
									<span>{val.label}</span>
									<span className="text-[7px] text-muted-foreground">{val.bpm} BPM</span>
								</div>
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<div className="flex justify-between text-[10px] text-muted-foreground">
						<span>Duration</span>
						<span className="font-mono">{params.duration}s</span>
					</div>
					<Slider
						value={[params.duration]}
						onValueChange={([v]) => setParams((p) => ({ ...p, duration: v }))}
						min={5}
						max={300}
						step={5}
					/>
				</div>

				<Button
					className="w-full"
					onClick={handleGenerate}
					disabled={isGenerating}
				>
					{isGenerating ? "Generating..." : `Generate ${params.duration}s ${params.genre}`}
				</Button>

				{generatedUrl && (
					<div className="space-y-2 rounded border p-2">
						<div className="flex items-center gap-2">
							<HugeiconsIcon icon={MusicNote01Icon} className="size-3 text-primary" />
							<span className="text-[10px] font-medium">
								{params.genre} - {params.mood}
							</span>
							<span className="text-[8px] text-muted-foreground">
								{generatedDuration.toFixed(1)}s
							</span>
						</div>
						<audio controls className="w-full h-6" src={generatedUrl}>
							<track kind="captions" />
						</audio>
						<Button
							size="sm"
							variant="outline"
							className="w-full h-6 text-[9px]"
							onClick={handleAddToTimeline}
						>
							<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
							Add to Timeline
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
