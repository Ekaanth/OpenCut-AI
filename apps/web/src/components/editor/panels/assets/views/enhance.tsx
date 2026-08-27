"use client";

import { useCallback, useRef, useState } from "react";
import { PanelView } from "./base-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useEditor } from "@/hooks/use-editor";
import { aiClient } from "@/lib/ai-client";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { toast } from "sonner";

export function EnhanceView() {
	const editor = useEditor();
	const [file, setFile] = useState<File | null>(null);
	const [strength, setStrength] = useState(0.7);
	const [isProcessing, setIsProcessing] = useState(false);
	const [resultUrl, setResultUrl] = useState<string | null>(null);
	const [resultBlob, setResultBlob] = useState<Blob | null>(null);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const addTask = useBackgroundTasksStore((s) => s.addTask);
	const updateTask = useBackgroundTasksStore((s) => s.updateTask);

	const handlePickFile = useCallback((f: File) => {
		setFile(f);
		setResultUrl(null);
		setResultBlob(null);
		setError(null);
	}, []);

	const handleEnhance = useCallback(async () => {
		if (!file) return;
		const taskId = `enhance-${Date.now()}`;
		addTask({ id: taskId, type: "voiceover", label: "Enhancing voice", progress: "Denoising..." });

		setIsProcessing(true);
		setError(null);
		try {
			const blob = await aiClient.denoiseAudio(file, strength);
			setResultBlob(blob);
			setResultUrl(URL.createObjectURL(blob));
			updateTask(taskId, { status: "completed", completedAt: Date.now() });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Voice enhance failed";
			setError(msg);
			updateTask(taskId, { status: "error", error: msg, completedAt: Date.now() });
		} finally {
			setIsProcessing(false);
		}
	}, [file, strength, addTask, updateTask]);

	const handleAddToTimeline = useCallback(async () => {
		if (!resultBlob) return;
		const outFile = new File([resultBlob], `enhanced_${Date.now()}.wav`, { type: "audio/wav" });
		const audioUrl = URL.createObjectURL(outFile);
		const duration = await getAudioDuration(audioUrl);
		const currentTime = editor.playback.getCurrentTime();
		const trackId = editor.timeline.addTrack({ type: "audio", index: 0 });

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId },
			element: {
				type: "audio",
				sourceType: "library",
				sourceUrl: audioUrl,
				name: "Enhanced voice",
				startTime: currentTime,
				duration: duration || 5,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: duration || 5,
				volume: 1,
			},
		});

		toast.success("Enhanced audio added to timeline");
	}, [editor, resultBlob]);

	return (
		<PanelView title="Voice Enhance">
			<div className="flex flex-col gap-4">
				<p className="text-[10px] text-muted-foreground">
					Removes background noise and hiss from a voice recording. Runs
					locally, free, no upload to any cloud service.
				</p>

				{/* ── Source file ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Audio file</Label>
					{file ? (
						<div className="flex items-center justify-between rounded-md bg-muted/50 border px-2.5 py-2">
							<span className="text-[11px] truncate">{file.name}</span>
							<button
								type="button"
								className="text-[10px] text-destructive hover:text-destructive/80 shrink-0 ml-2"
								onClick={() => {
									setFile(null);
									setResultUrl(null);
									setResultBlob(null);
								}}
							>
								Remove
							</button>
						</div>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="w-full text-[11px] h-8"
							onClick={() => fileInputRef.current?.click()}
						>
							Choose audio file
						</Button>
					)}
					<input
						ref={fileInputRef}
						type="file"
						accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handlePickFile(f);
							e.target.value = "";
						}}
					/>
				</div>

				{/* ── Strength ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Strength ({Math.round(strength * 100)}%)</Label>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={strength}
						onChange={(e) => setStrength(parseFloat(e.target.value))}
						className="w-full accent-primary"
					/>
					<div className="flex justify-between text-[9px] text-muted-foreground">
						<span>None</span>
						<span>Max</span>
					</div>
				</div>

				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-2.5">
						<p className="text-destructive text-[11px]">{error}</p>
					</div>
				)}

				<Button
					className="w-full"
					onClick={handleEnhance}
					disabled={!file || isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					Enhance voice
				</Button>

				{/* ── Preview ── */}
				{resultUrl && (
					<div className="flex flex-col gap-2 rounded-md border p-2.5 bg-muted/30">
						<p className="text-[10px] text-muted-foreground font-medium">Preview</p>
						<audio src={resultUrl} controls className="w-full h-8" />
						<Button
							variant="outline"
							size="sm"
							className="w-full text-[11px]"
							onClick={handleAddToTimeline}
						>
							Add to timeline
						</Button>
					</div>
				)}
			</div>
		</PanelView>
	);
}

function getAudioDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio(url);
		audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
		audio.addEventListener("error", () => resolve(5));
	});
}
