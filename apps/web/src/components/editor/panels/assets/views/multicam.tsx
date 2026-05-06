"use client";

import { useCallback, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { detectMulticamAngles, switchAngle, createMulticamClip } from "@/lib/multicam";
import type { MulticamAngle, MulticamClip } from "@/lib/multicam";

export function MulticamPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const angles = detectMulticamAngles(tracks);
	const [multicamClip, setMulticamClip] = useState<MulticamClip | null>(null);
	const [isSynced, setIsSynced] = useState(false);

	const hasMultipleAngles = angles.length >= 2;

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
					{!isSynced ? (
						<Button
							size="sm"
							className="w-full"
							onClick={handleSync}
						>
							Sync Angles
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
			)}
		</div>
	);
}
