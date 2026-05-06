"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { RecordIcon, PauseIcon, StopCircleIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useAudioRecording } from "@/hooks/use-audio-recording";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecordingPanel({ className }: { className?: string }) {
	const { state, startRecording, pauseRecording, resumeRecording, stopRecording, addToTimeline } =
		useAudioRecording();
	const [recordingName, setRecordingName] = useState("Recording");
	const [recordingCount, setRecordingCount] = useState(1);

	const handleStop = useCallback(async () => {
		const result = await stopRecording();
		if (result) {
			const name = `${recordingName} ${recordingCount}`;
			await addToTimeline(result.blob, result.duration, name);
			setRecordingCount((c) => c + 1);
		}
	}, [stopRecording, addToTimeline, recordingName, recordingCount]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={RecordIcon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Audio Recording</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Record audio directly to your timeline.
				</p>
			</div>

			<div className="px-4 py-3 space-y-4 flex-1">
				{!state.isRecording && (
					<div className="space-y-1.5">
						<span className="text-[10px] text-muted-foreground">Recording Name</span>
						<input
							className="w-full rounded border bg-transparent px-2 py-1 text-[10px] placeholder:text-muted-foreground"
							value={recordingName}
							onChange={(e) => setRecordingName(e.target.value)}
							placeholder="Recording name..."
						/>
					</div>
				)}

				{state.isRecording && (
					<>
						<div className="text-center">
							<span
								className={cn(
									"text-2xl font-mono",
									state.isPaused && "text-yellow-500",
								)}
							>
								{formatTime(state.duration)}
							</span>
							{state.isPaused && (
								<span className="block text-[9px] text-yellow-500 mt-1">PAUSED</span>
							)}
						</div>

						<div className="flex items-end justify-center gap-0.5 h-8">
							{state.levels.map((level, i) => (
								<div
									key={i}
									className={cn(
										"w-2 rounded-t transition-all duration-75",
										level > 0.8
											? "bg-red-500"
											: level > 0.5
												? "bg-yellow-500"
												: "bg-green-500",
									)}
									style={{ height: `${Math.max(level * 100, 4)}%` }}
								/>
							))}
						</div>

						<div className="flex gap-2">
							{!state.isPaused ? (
								<Button
									variant="outline"
									className="flex-1 h-8"
									onClick={pauseRecording}
								>
									<HugeiconsIcon icon={PauseIcon} className="size-4 mr-1" />
									Pause
								</Button>
							) : (
								<Button
									variant="outline"
									className="flex-1 h-8"
									onClick={resumeRecording}
								>
									<HugeiconsIcon icon={PlayIcon} className="size-4 mr-1" />
									Resume
								</Button>
							)}
							<Button
								variant="destructive"
								className="flex-1 h-8"
								onClick={handleStop}
							>
								<HugeiconsIcon icon={StopCircleIcon} className="size-4 mr-1" />
								Stop & Add
							</Button>
						</div>
					</>
				)}

				{!state.isRecording && (
					<Button className="w-full h-10" onClick={startRecording}>
						<HugeiconsIcon icon={RecordIcon} className="size-4 mr-2" />
						Start Recording
					</Button>
				)}
			</div>
		</div>
	);
}
