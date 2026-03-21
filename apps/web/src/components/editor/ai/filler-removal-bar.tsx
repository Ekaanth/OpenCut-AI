"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Spinner } from "@/components/ui/spinner";

// ----- Types -----

export type FillerSensitivity = "low" | "medium" | "high";

interface FillerRemovalBarProps {
	fillerCount: number;
	sensitivity: FillerSensitivity;
	onSensitivityChange: (sensitivity: FillerSensitivity) => void;
	onReview: () => void;
	onRemoveAll: () => Promise<void>;
	isRemoving?: boolean;
	className?: string;
}

// ----- Helpers -----

const SENSITIVITY_MAP: Record<
	FillerSensitivity,
	{ value: number; label: string; description: string }
> = {
	low: {
		value: 0,
		label: "Low",
		description: "Only obvious fillers (um, uh)",
	},
	medium: {
		value: 1,
		label: "Medium",
		description: "Common fillers (um, uh, like, you know)",
	},
	high: {
		value: 2,
		label: "High",
		description: "All fillers including subtle ones",
	},
};

function sliderToSensitivity(value: number): FillerSensitivity {
	if (value <= 0) return "low";
	if (value <= 1) return "medium";
	return "high";
}

// ----- Component -----

export function FillerRemovalBar({
	fillerCount,
	sensitivity,
	onSensitivityChange,
	onReview,
	onRemoveAll,
	isRemoving = false,
	className,
}: FillerRemovalBarProps) {
	const [showConfirm, setShowConfirm] = useState(false);

	const handleRemoveAll = async () => {
		setShowConfirm(false);
		await onRemoveAll();
	};

	const sensitivityInfo = SENSITIVITY_MAP[sensitivity];

	return (
		<>
			<div
				className={cn(
					"flex items-center gap-3 bg-background border rounded-md px-4 py-2.5",
					className,
				)}
			>
				{/* Count */}
				<div className="flex items-center gap-2 shrink-0">
					<Badge
						variant={fillerCount > 0 ? "default" : "secondary"}
						className="tabular-nums"
					>
						{fillerCount}
					</Badge>
					<span className="text-sm text-muted-foreground">
						filler word{fillerCount !== 1 ? "s" : ""} detected
					</span>
				</div>

				{/* Sensitivity */}
				<div className="flex items-center gap-2 border-l pl-3 flex-1">
					<Label className="text-xs text-muted-foreground shrink-0">
						Sensitivity
					</Label>
					<Slider
						value={[SENSITIVITY_MAP[sensitivity].value]}
						onValueChange={([v]) =>
							onSensitivityChange(sliderToSensitivity(v ?? 0))
						}
						min={0}
						max={2}
						step={1}
						className="w-24"
					/>
					<span className="text-xs text-muted-foreground w-14">
						{sensitivityInfo.label}
					</span>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2 border-l pl-3 shrink-0">
					<Button
						variant="outline"
						size="sm"
						onClick={onReview}
						disabled={fillerCount === 0 || isRemoving}
					>
						Review
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={() => setShowConfirm(true)}
						disabled={fillerCount === 0 || isRemoving}
					>
						{isRemoving ? (
							<>
								<Spinner className="size-3 mr-1" />
								Removing...
							</>
						) : (
							"Remove All"
						)}
					</Button>
				</div>
			</div>

			{/* Confirmation dialog */}
			<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove all filler words?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove {fillerCount} filler word
							{fillerCount !== 1 ? "s" : ""} from the timeline.
							Sensitivity is set to{" "}
							<strong>{sensitivityInfo.label.toLowerCase()}</strong> (
							{sensitivityInfo.description.toLowerCase()}). This action can
							be undone with Ctrl+Z.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleRemoveAll}>
							Remove All
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
