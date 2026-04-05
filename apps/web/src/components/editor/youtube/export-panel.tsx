"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useYouTubeReelsStore } from "@/stores/youtube-reels-store";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import { toast } from "sonner";

export function ExportPanel() {
	const clips = useYouTubeReelsStore((s) => s.generatedClips);
	const message = useYouTubeReelsStore((s) => s.jobMessage);
	const generateJobId = useYouTubeReelsStore((s) => s.generateJobId);
	const reset = useYouTubeReelsStore((s) => s.reset);
	const editor = useEditor();
	const baseUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420";
	const [addingIndex, setAddingIndex] = useState<number | null>(null);

	const getClipUrl = (clipIndex: number) =>
		`${baseUrl}/api/youtube/download-clip/${generateJobId}/${clipIndex}`;

	const downloadClip = (clipIndex: number) => {
		const a = document.createElement("a");
		a.href = getClipUrl(clipIndex);
		a.download = `reel_${clipIndex + 1}.mp4`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const addToAssets = async (clipIndex: number) => {
		const activeProject = editor.project.getActive();
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setAddingIndex(clipIndex);
		try {
			const resp = await fetch(getClipUrl(clipIndex));
			if (!resp.ok) throw new Error("Failed to fetch clip");

			const blob = await resp.blob();
			const file = new File([blob], `reel_${clipIndex + 1}.mp4`, { type: "video/mp4" });

			// Process the file to extract metadata (duration, dimensions, thumbnail)
			// Same pipeline as dragging a file into the assets panel
			const processed = await processMediaAssets({ files: [file] });

			for (const asset of processed) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}

			toast.success(`Reel ${clipIndex + 1} added to assets`);
		} catch (e) {
			console.error("Failed to add reel to assets:", e);
			toast.error("Failed to add reel to assets");
		} finally {
			setAddingIndex(null);
		}
	};

	const downloadAll = () => {
		clips.forEach((clip, i) => {
			setTimeout(() => downloadClip(clip.clip_index), i * 500);
		});
	};

	const addAllToAssets = async () => {
		for (const clip of clips) {
			await addToAssets(clip.clip_index);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold">{message}</h3>
				<Badge variant="secondary" className="text-xs">
					{clips.length} reel{clips.length !== 1 ? "s" : ""}
				</Badge>
			</div>

			<div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
				{clips.map((clip) => (
					<div key={clip.clip_index} className="flex items-center justify-between rounded-lg border p-3">
						<div className="space-y-0.5">
							<span className="text-sm font-medium">Reel {clip.clip_index + 1}</span>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{Math.round(clip.duration)}s</span>
								<span>{clip.file_size_mb.toFixed(1)} MB</span>
							</div>
						</div>
						<div className="flex gap-1.5">
							<Button
								size="sm"
								variant="default"
								disabled={addingIndex === clip.clip_index}
								onClick={() => { addToAssets(clip.clip_index).catch(() => {}); }}
							>
								{addingIndex === clip.clip_index ? "Adding..." : "Add to Editor"}
							</Button>
							<Button size="sm" variant="outline" onClick={() => downloadClip(clip.clip_index)}>
								Download
							</Button>
						</div>
					</div>
				))}
			</div>

			{clips.length > 1 && (
				<div className="flex gap-2">
					<Button
						variant="default"
						className="flex-1"
						onClick={() => { addAllToAssets().catch(() => {}); }}
					>
						Add All to Editor
					</Button>
					<Button variant="outline" className="flex-1" onClick={downloadAll}>
						Download All
					</Button>
				</div>
			)}

			<Button variant="ghost" className="w-full" onClick={reset}>
				Start Over
			</Button>
		</div>
	);
}
