"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import type { TimelineTrack, VideoTrack, AudioTrack } from "@/types/timeline";

type AudioTrackish = VideoTrack | AudioTrack;

function isAudioTrackish(track: TimelineTrack): track is AudioTrackish {
	return track.type === "video" || track.type === "audio";
}

function LevelMeter({
	getLevels,
	isPlaying,
}: {
	getLevels: () => { peak: number; rms: number };
	isPlaying: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animRef = useRef<number>(0);
	const peakHoldRef = useRef(0);
	const peakDecayRef = useRef(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const draw = () => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const { peak, rms } = isPlaying ? getLevels() : { peak: 0, rms: 0 };
			const dbPeak = 20 * Math.log10(Math.max(peak, 0.0001));
			const dbRms = 20 * Math.log10(Math.max(rms, 0.0001));
			const normalizedPeak = Math.max(0, (dbPeak + 60) / 60);
			const normalizedRms = Math.max(0, (dbRms + 60) / 60);

			if (normalizedPeak >= peakHoldRef.current) {
				peakHoldRef.current = normalizedPeak;
				peakDecayRef.current = 0;
			} else {
				peakDecayRef.current += 1;
				if (peakDecayRef.current > 30) {
					peakHoldRef.current = Math.max(
						normalizedPeak,
						peakHoldRef.current - 0.02,
					);
				}
			}

			const w = canvas.width;
			const h = canvas.height;
			ctx.clearRect(0, 0, w, h);

			const barWidth = w;
			const barHeight = 3;
			const y = (h - barHeight) / 2;

			ctx.fillStyle = "rgba(255,255,255,0.05)";
			ctx.fillRect(0, y, barWidth, barHeight);

			const greenEnd = barWidth * 0.6;
			const yellowEnd = barWidth * 0.85;

			const rmsWidth = normalizedRms * barWidth;
			const gradient = ctx.createLinearGradient(0, 0, barWidth, 0);
			gradient.addColorStop(0, "#22c55e");
			gradient.addColorStop(0.6, "#22c55e");
			gradient.addColorStop(0.85, "#eab308");
			gradient.addColorStop(1, "#ef4444");
			ctx.fillStyle = gradient;
			ctx.fillRect(0, y, Math.min(rmsWidth, greenEnd), barHeight);
			if (rmsWidth > greenEnd) {
				ctx.fillRect(greenEnd, y, Math.min(rmsWidth, yellowEnd) - greenEnd, barHeight);
			}
			if (rmsWidth > yellowEnd) {
				ctx.fillRect(yellowEnd, y, rmsWidth - yellowEnd, barHeight);
			}

			const peakX = peakHoldRef.current * barWidth;
			ctx.fillStyle = peakHoldRef.current > 0.85 ? "#ef4444" : "#22c55e";
			ctx.fillRect(peakX - 1, y, 1, barHeight);

			animRef.current = requestAnimationFrame(draw);
		};

		animRef.current = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(animRef.current);
	}, [getLevels, isPlaying]);

	return (
		<canvas
			ref={canvasRef}
			width={80}
			height={8}
			className="w-full h-2 rounded-sm"
		/>
	);
}

function TrackMixerStrip({
	track,
	editor,
	isPlaying,
}: {
	track: AudioTrackish;
	editor: ReturnType<typeof useEditor>;
	isPlaying: boolean;
}) {
	const volume = track.volume ?? 1;
	const pan = "pan" in track ? track.pan ?? 0 : 0;
	const isMuted = track.muted;
	const isSolo = track.solo ?? false;

	const handleVolumeChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const val = parseFloat(e.target.value);
			editor.timeline.updateTrack({
				trackId: track.id,
				updates: { volume: val },
			});
			editor.audio.updateTrackVolume(track.id, val);
		},
		[editor, track.id],
	);

	const handlePanChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const val = parseFloat(e.target.value);
			editor.timeline.updateTrack({
				trackId: track.id,
				updates: { pan: val },
			});
			editor.audio.updateTrackPan(track.id, val);
		},
		[editor, track.id],
	);

	const handleMuteToggle = useCallback(() => {
		editor.timeline.updateTrack({
			trackId: track.id,
			updates: { muted: !isMuted },
		});
	}, [editor, track.id, isMuted]);

	const handleSoloToggle = useCallback(() => {
		editor.timeline.updateTrack({
			trackId: track.id,
			updates: { solo: !isSolo },
		});
	}, [editor, track.id, isSolo]);

	const getLevels = useCallback(
		() => editor.audio.getTrackLevels(track.id),
		[editor, track.id],
	);

	const dbValue = 20 * Math.log10(Math.max(volume, 0.0001));

	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 p-2 rounded-md border",
				isMuted ? "opacity-40" : "border-border",
			)}
		>
			<div className="flex items-center justify-between gap-1">
				<span className="text-[9px] font-medium truncate max-w-[70px]">
					{track.name}
				</span>
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={handleSoloToggle}
						className={cn(
							"size-4 rounded text-[7px] font-bold flex items-center justify-center border",
							isSolo
								? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500"
								: "border-border text-muted-foreground",
						)}
					>
						S
					</button>
					<button
						type="button"
						onClick={handleMuteToggle}
						className={cn(
							"size-4 rounded text-[7px] font-bold flex items-center justify-center border",
							isMuted
								? "bg-red-500/20 border-red-500/50 text-red-500"
								: "border-border text-muted-foreground",
						)}
					>
						M
					</button>
				</div>
			</div>

			<LevelMeter getLevels={getLevels} isPlaying={isPlaying} />

			<input
				type="range"
				min="0"
				max="2"
				step="0.01"
				value={volume}
				onChange={handleVolumeChange}
				className="w-full h-1 accent-primary"
			/>
			<span className="text-[8px] text-muted-foreground text-center font-mono">
				{dbValue.toFixed(1)} dB
			</span>

			{"pan" in track && (
				<div className="flex flex-col gap-0.5">
					<input
						type="range"
						min="-1"
						max="1"
						step="0.01"
						value={pan}
						onChange={handlePanChange}
						className="w-full h-1 accent-primary"
					/>
					<span className="text-[8px] text-muted-foreground text-center">
						{pan === 0 ? "C" : pan < 0 ? `L${Math.abs(Math.round(pan * 100))}` : `R${Math.round(pan * 100)}`}
					</span>
				</div>
			)}
		</div>
	);
}

export function AudioMixerPanel() {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const isPlaying = editor.playback.getIsPlaying();

	const audioTracks = tracks.filter(isAudioTrackish);

	const masterLevels = useCallback(
		() => editor.audio.getMasterLevels(),
		[editor],
	);

	if (audioTracks.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
				<span className="text-[10px]">No audio tracks</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-medium">Mixer</span>
				<span className="text-[9px] text-muted-foreground">
					{audioTracks.length} track{audioTracks.length !== 1 ? "s" : ""}
				</span>
			</div>

			<div className="flex gap-2 overflow-x-auto pb-1">
				{audioTracks.map((track) => (
					<TrackMixerStrip
						key={track.id}
						track={track}
						editor={editor}
						isPlaying={isPlaying}
					/>
				))}

				<div className="flex flex-col gap-1.5 p-2 rounded-md border border-primary/20 min-w-[90px]">
					<span className="text-[9px] font-medium text-center">Master</span>
					<LevelMeter getLevels={masterLevels} isPlaying={isPlaying} />
					<span className="text-[8px] text-muted-foreground text-center font-mono">
						{(editor.playback.getVolume() * 100).toFixed(0)}%
					</span>
				</div>
			</div>
		</div>
	);
}
