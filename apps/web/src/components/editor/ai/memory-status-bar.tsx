"use client";

import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// ----- Types -----

export interface MemoryStatusInfo {
	gpuUsedMb: number;
	gpuTotalMb: number;
	ramUsedMb: number;
	ramTotalMb: number;
}

interface MemoryStatusBarProps {
	status: MemoryStatusInfo;
	className?: string;
}

// ----- Helpers -----

function formatMb(mb: number): string {
	if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
	return `${mb}MB`;
}

function getUsageColor(percent: number): string {
	if (percent >= 90) return "bg-red-500";
	if (percent >= 75) return "bg-yellow-500";
	return "bg-green-500";
}

function getTextColor(percent: number): string {
	if (percent >= 90) return "text-red-500";
	if (percent >= 75) return "text-yellow-500";
	return "text-green-500";
}

// ----- Component -----

export function MemoryStatusBar({
	status,
	className,
}: MemoryStatusBarProps) {
	const gpuPercent =
		status.gpuTotalMb > 0
			? Math.round((status.gpuUsedMb / status.gpuTotalMb) * 100)
			: 0;

	const ramPercent =
		status.ramTotalMb > 0
			? Math.round((status.ramUsedMb / status.ramTotalMb) * 100)
			: 0;

	const hasGpu = status.gpuTotalMb > 0;
	const hasRam = status.ramTotalMb > 0;
	const hasAnyData = hasGpu || hasRam;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className={cn(
						"flex items-center gap-2 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors cursor-default border border-border/50",
						className,
					)}
				>
					{/* Green dot — always visible when connected */}
					<span className="size-1.5 rounded-full bg-green-500 shrink-0" />

					{/* GPU bar */}
					{hasGpu && (
						<div className="flex items-center gap-1.5">
							<span className="text-[10px] font-medium w-6">GPU</span>
							<div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full transition-all duration-500",
										getUsageColor(gpuPercent),
									)}
									style={{ width: `${gpuPercent}%` }}
								/>
							</div>
							<span
								className={cn(
									"text-[10px] tabular-nums w-8",
									getTextColor(gpuPercent),
								)}
							>
								{gpuPercent}%
							</span>
						</div>
					)}

					{/* RAM bar */}
					{hasRam && (
						<div className="flex items-center gap-1.5">
							<span className="text-[10px] font-medium w-7">RAM</span>
							<div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full transition-all duration-500",
										getUsageColor(ramPercent),
									)}
									style={{ width: `${ramPercent}%` }}
								/>
							</div>
							<span
								className={cn(
									"text-[10px] tabular-nums w-8",
									getTextColor(ramPercent),
								)}
							>
								{ramPercent}%
							</span>
						</div>
					)}

					{/* Fallback when no memory data is available */}
					{!hasAnyData && (
						<span className="text-[10px]">AI Connected</span>
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent side="top">
				<div className="flex flex-col gap-1.5 text-xs">
					{hasGpu && (
						<div className="flex items-center justify-between gap-6">
							<span className="font-medium">GPU Memory</span>
							<span className={getTextColor(gpuPercent)}>
								{formatMb(status.gpuUsedMb)} /{" "}
								{formatMb(status.gpuTotalMb)}
							</span>
						</div>
					)}
					{hasRam && (
						<div className="flex items-center justify-between gap-6">
							<span className="font-medium">RAM Usage</span>
							<span className={getTextColor(ramPercent)}>
								{formatMb(status.ramUsedMb)} /{" "}
								{formatMb(status.ramTotalMb)}
							</span>
						</div>
					)}
					{!hasAnyData && (
						<p className="text-muted-foreground">
							AI backend connected. Memory stats not available.
						</p>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
