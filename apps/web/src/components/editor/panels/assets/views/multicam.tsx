"use client";

import { useCallback, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { detectMulticamAngles, switchAngle, createMulticamClip } from "@/lib/multicam";
import type { MulticamClip } from "@/lib/multicam";
import { useMulticamSync } from "@/hooks/use-multicam-sync";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export function MulticamPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const angles = detectMulticamAngles(tracks);
	const [multicamClip, setMulticamClip] = useState<MulticamClip | null>(null);
	const [isSynced, setIsSynced] = useState(false);

	// ── Auto audio-sync state ──
	const { compute, apply, isSyncing, progressMsg, previewOffsets } =
		useMulticamSync();
	const [referenceTrackId, setReferenceTrackId] = useState<string>("");
	const [searchWindow, setSearchWindow] = useState(60);

	const hasMultipleAngles = angles.length >= 2;
	const effectiveRefId = referenceTrackId || angles[0]?.trackId || "";

	const handleAutoSync = useCallback(async () => {
		await compute(effectiveRefId, searchWindow);
	}, [compute, effectiveRefId, searchWindow]);

	const handleSync = useCallback(() => {
		if (!hasMultipleAngles) return;
		const currentTime = editor.playback.getCurrentTime();
		const clip = createMulticamClip({
			angles,
			startTime: currentTime,
			duration: 30,
		});
		setMulticamClip(clip);
		setIsSynced(true);
	}, [editor, angles, hasMultipleAngles]);

	const handleSwitchAngle = useCallback(
		(index: number) => {
			if (!multicamClip) return;
			const updated = switchAngle(multicamClip, index);
			setMulticamClip(updated);

			const activeTrack = tracks.find(
				(t) => t.id === updated.angles[index].trackId,
			);
			if (activeTrack) {
				const otherVideoTracks = tracks.filter(
					(t) => t.type === "video" && t.id !== activeTrack.id,
				);
				for (const other of otherVideoTracks) {
					editor.timeline.updateTrack({
						trackId: other.id,
						updates: { hidden: true },
					});
				}
				editor.timeline.updateTrack({
					trackId: activeTrack.id,
					updates: { hidden: false },
				});
			}
		},
		[multicamClip, tracks, editor],
	);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-3 py-2 border-b flex items-center gap-2">
				<HugeiconsIcon icon={Camera01Icon} className="size-4 text-primary" />
				<span className="text-xs font-medium">Multicam</span>
				<Badge variant="secondary" className="text-[8px] px-1 py-0">
					{angles.length} angles
				</Badge>
			</div>

			{!hasMultipleAngles ? (
				<div className="text-center py-8 px-4">
					<HugeiconsIcon
						icon={Camera01Icon}
						className="size-8 text-muted-foreground/40 mx-auto mb-2"
					/>
					<p className="text-sm text-muted-foreground">
						Add 2+ video tracks to use multicam
					</p>
				</div>
			) : (
					<div className="p-3 space-y-3">
					{/* ── Auto audio sync (cross-correlation) ── */}
					<div className="rounded-md border border-border p-2 flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-medium">Auto audio sync</span>
							<Badge variant="outline" className="text-[8px] px-1 py-0">
								On-device
							</Badge>
						</div>
						<p className="text-[9px] text-muted-foreground leading-relaxed">
							Aligns angles by matching their audio waveforms — no timecode
							needed. Each angle must have an audio track.
						</p>

						<div className="flex flex-col gap-1">
							<span className="text-[9px] text-muted-foreground">Reference angle</span>
							<Select
								value={effectiveRefId}
								onValueChange={setReferenceTrackId}
							>
								<SelectTrigger className="h-7 text-[10px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{angles.map((a) => (
										<SelectItem key={a.trackId} value={a.trackId} className="text-[10px]">
											{a.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<label className="flex items-center gap-1 text-[9px] text-muted-foreground">
							<span>Search ±</span>
							<input
								type="range"
								min={10}
								max={180}
								step={10}
								value={searchWindow}
								onChange={(e) => setSearchWindow(Number(e.target.value))}
								className="flex-1 accent-primary h-1"
							/>
							<span className="w-10 text-right">{searchWindow}s</span>
						</label>

						<Button
							size="sm"
							className="w-full h-7 text-[10px]"
							onClick={handleAutoSync}
							disabled={isSyncing}
						>
							{isSyncing ? "Analyzing…" : "Compute offsets"}
						</Button>

						{progressMsg && (
							<p className="text-[9px] text-muted-foreground animate-pulse truncate">
								{progressMsg}
							</p>
						)}

						{previewOffsets && previewOffsets.length > 0 && (
							<div className="flex flex-col gap-1 mt-1">
								{previewOffsets.map((off) => {
									const angle = angles.find((a) => a.trackId === off.trackId);
									return (
										<div
											key={off.trackId}
											className="flex items-center justify-between text-[9px] px-1 py-0.5 rounded bg-muted/40"
										>
											<span className="truncate flex-1">{angle?.label ?? off.trackId}</span>
											{off.skipped ? (
												<span className="text-amber-600">skipped</span>
											) : (
												<>
													<span className="font-mono">
														{off.offsetSeconds >= 0 ? "+" : ""}
														{off.offsetSeconds.toFixed(2)}s
													</span>
													<span
														className={cn(
															"ml-1 px-1 rounded text-[8px]",
															off.score >= 0.5
																? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
																: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
														)}
													>
														{Math.round(off.score * 100)}%
													</span>
												</>
											)}
										</div>
									);
								})}
								<Button
									size="sm"
									variant="secondary"
									className="w-full h-7 text-[10px] mt-1"
									onClick={apply}
								>
									Apply sync
								</Button>
							</div>
						)}
					</div>

					{/* ── Angle switcher (existing flow) ── */}
					<div className="border-t pt-3">
					{!isSynced ? (
						<Button
							size="sm"
							className="w-full"
							onClick={handleSync}
						>
							Open Angle Switcher
						</Button>
					) : (
						<>
							<p className="text-[10px] text-muted-foreground">
								Press 1-{angles.length} to switch angles during playback
							</p>
							<div className="space-y-1">
								{angles.map((angle, idx) => (
									<Button
										key={angle.trackId}
										size="sm"
										variant={
											multicamClip?.activeAngleIndex === idx
												? "secondary"
												: "ghost"
										}
										className="w-full h-8 text-[10px] justify-start"
										onClick={() => handleSwitchAngle(idx)}
									>
										<span className="size-4 rounded bg-muted flex items-center justify-center text-[8px] font-mono mr-2">
											{idx + 1}
										</span>
										{angle.label}
										{multicamClip?.activeAngleIndex === idx && (
											<Badge className="ml-auto text-[8px] px-1 py-0">Active</Badge>
										)}
									</Button>
								))}
							</div>
						</>
					)}
				</div>
				</div>
			)}
		</div>
	);
}
