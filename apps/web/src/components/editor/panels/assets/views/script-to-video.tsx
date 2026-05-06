"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";
import { useScriptToVideo } from "@/hooks/use-script-to-video";
import {
	SCRIPT_STYLES,
	DEFAULT_SCRIPT_CONFIG,
	type ScriptToVideoConfig,
} from "@/lib/script-to-video/script-types";

export function ScriptToVideoPanel({ className }: { className?: string }) {
	const { generate } = useScriptToVideo();
	const [script, setScript] = useState("");
	const [style, setStyle] = useState<ScriptToVideoConfig["style"]>("explainer");
	const [isGenerating, setIsGenerating] = useState(false);

	const handleGenerate = useCallback(async () => {
		if (!script.trim()) return;
		setIsGenerating(true);
		try {
			await generate(script, { style });
		} finally {
			setIsGenerating(false);
		}
	}, [generate, script, style]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={File01Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Script to Video</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Write or paste a script. AI generates voiceover, visuals, and timeline.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1 overflow-y-auto">
				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Script</span>
					<textarea
						className="w-full rounded border bg-transparent px-2 py-1 text-[10px] resize-none h-40 placeholder:text-muted-foreground font-mono"
						placeholder={`# Title Scene\nWrite your narration here...\n\nEach paragraph becomes a scene.\nLines starting with # become title cards.\n\n# Conclusion\nWrap up your video here.`}
						value={script}
						onChange={(e) => setScript(e.target.value)}
					/>
					<span className="text-[8px] text-muted-foreground">
						{script.split("\n").filter((l) => l.trim()).length} sections,{" "}
						{script.split(/\s+/).filter(Boolean).length} words
					</span>
				</div>

				<div className="space-y-1.5">
					<span className="text-[10px] text-muted-foreground">Style</span>
					<div className="flex flex-wrap gap-1">
						{SCRIPT_STYLES.map((s) => (
							<Button
								key={s.value}
								variant={style === s.value ? "secondary" : "ghost"}
								size="sm"
								className="h-5 text-[8px] px-1.5"
								onClick={() => setStyle(s.value)}
							>
								{s.label}
							</Button>
						))}
					</div>
				</div>

				<Button
					className="w-full"
					onClick={handleGenerate}
					disabled={isGenerating || !script.trim()}
				>
					{isGenerating ? "Generating Video..." : "Generate from Script"}
				</Button>
			</div>
		</div>
	);
}
