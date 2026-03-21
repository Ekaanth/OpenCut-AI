"use client";

import { useMemo, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ----- Types -----

export interface SilenceRegionData {
	id: string;
	startTime: number;
	endTime: number;
	duration: number;
}

interface SilenceRemovalBarProps {
	silences: SilenceRegionData[];
	threshold: number;
	onThresholdChange: (threshold: number) => void;
	onRemoveSilences: () => Promise<void>;
	isRemoving?: boolean;
	className?: string;
}

// ----- Helpers -----

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}m ${secs.toFixed(0)}s`;
}

// ----- Component -----

export function SilenceRemovalBar({
	silences,
	threshold,
	onThresholdChange,
	onRemoveSilences,
	isRemoving = false,
	className,
}: SilenceRemovalBarProps) {
	const [showConfirm, setShowConfirm] = useState(false);

	const filteredSilences = useMemo(
		() => silences.filter((s) => s.duration >= threshold),
		[silences, threshold],
	);

	const totalDuration = useMemo(
		() => filteredSilences.reduce((acc, s) => acc + s.duration, 0),
		[filteredSilences],
	);

	const handleRemove = async () => {
		setShowConfirm(false);
		await onRemoveSilences();
	};

	// Visual preview of silence distribution
	const maxDuration = useMemo(() => {
		if (silences.length === 0) return 1;
		return Math.max(...silences.map((s) => s.duration));
	}, [silences]);

	return (
		<>
			<div
				className={cn(
					"flex flex-col gap-2.5 bg-background border rounded-md px-4 py-3",
					className,
				)}
			>
				{/* Info row */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Badge
							variant={filteredSilences.length > 0 ? "default" : "secondary"}
							className="tabular-nums"
						>
							{filteredSilences.length}
						</Badge>
						<span className="text-sm text-muted-foreground">
							silence region{filteredSilences.length !== 1 ? "s" : ""}{" "}
							detected
							{filteredSilences.length > 0 && (
								<span className="text-xs ml-1">
									(total {formatDuration(totalDuration)})
								</span>
							)}
						</span>
					</div>
					<Button
						variant="default"
						size="sm"
						onClick={() => setShowConfirm(true)}
						disabled={filteredSilences.length === 0 || isRemoving}
					>
						{isRemoving ? (
							<>
								<Spinner className="size-3 mr-1" />
								Removing...
							</>
						) : (
							"Remove Long Silences"
						)}
					</Button>
				</div>

				{/* Threshold slider */}
				<div className="flex items-center gap-3">
					<Label className="text-xs text-muted-foreground shrink-0 w-20">
						Threshold
					</Label>
					<Slider
						value={[threshold]}
						onValueChange={([v]) => onThresholdChange(v ?? 0.5)}
						min={0.5}
						max={5}
						step={0.25}
						className="flex-1"
					/>
					<span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
						{threshold.toFixed(1)}s
					</span>
				</div>

				{/* Visual preview of silences */}
				{silences.length > 0 && (
					<div className="flex items-end gap-px h-6">
						{silences.map((silence) => {
							const height = Math.max(
								4,
								(silence.duration / maxDuration) * 24,
							);
							const isAboveThreshold = silence.duration >= threshold;

							return (
								<div
									key={silence.id}
									className={cn(
										"flex-1 min-w-0.5 max-w-3 rounded-t-sm transition-colors",
										isAboveThreshold
											? "bg-destructive/60"
											: "bg-muted-foreground/20",
									)}
									style={{ height: `${height}px` }}
									title={`${silence.duration.toFixed(1)}s silence`}
								/>
							);
						})}
					</div>
				)}
			</div>

			{/* Confirmation */}
			<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove {filteredSilences.length} silence region
							{filteredSilences.length !== 1 ? "s" : ""}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove all silences longer than{" "}
							{threshold.toFixed(1)}s, saving approximately{" "}
							{formatDuration(totalDuration)} of total duration. This
							action can be undone with Ctrl+Z.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleRemove}>
							Remove Silences
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
