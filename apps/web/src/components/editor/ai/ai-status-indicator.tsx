"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/ui";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { AIErrorType } from "@/types/ai";
import { useServiceHealth } from "@/hooks/use-service-health";

export interface AIStatusInfo {
	connected: boolean;
	modelsLoaded: string[];
	memoryUsageMb: number;
	memoryTotalMb: number;
	gpuAvailable: boolean;
	backendVersion?: string;
	error?: string;
	errorType?: AIErrorType;
	backendUrl?: string;
}

interface AIStatusIndicatorProps {
	status: AIStatusInfo;
	onSetupClick?: () => void;
	onRefresh?: () => void;
	className?: string;
}

function formatMb(mb: number): string {
	if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
	return `${Math.round(mb)} MB`;
}

export function AIStatusIndicator({
	status,
	onSetupClick,
	onRefresh,
	className,
}: AIStatusIndicatorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [uptime, setUptime] = useState(0);
	const { services } = useServiceHealth(isOpen);

	// Track uptime when connected
	useEffect(() => {
		if (!status.connected) {
			setUptime(0);
			return;
		}

		const start = Date.now();
		const timer = setInterval(() => {
			setUptime(Math.floor((Date.now() - start) / 1000));
		}, 1000);

		return () => clearInterval(timer);
	}, [status.connected]);

	const memoryPercent =
		status.memoryTotalMb > 0
			? Math.round((status.memoryUsageMb / status.memoryTotalMb) * 100)
			: 0;

	const memoryBarColor =
		memoryPercent > 85
			? "[&>div]:bg-red-500"
			: memoryPercent > 60
				? "[&>div]:bg-yellow-500"
				: "[&>div]:bg-green-500";

	const formatUptime = (s: number) => {
		if (s < 60) return `${s}s`;
		if (s < 3600) return `${Math.floor(s / 60)}m`;
		return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all cursor-pointer border",
						status.connected
							? "text-foreground border-border hover:bg-accent"
							: "text-red-400 border-red-500/20 hover:bg-red-500/10",
						isOpen && "bg-accent",
						className,
					)}
					aria-label={`AI backend ${status.connected ? "connected" : "disconnected"}`}
				>
					<span className="relative flex size-2">
						{status.connected && (
							<span className="absolute inline-flex size-full rounded-full opacity-75 animate-ping bg-green-400" />
						)}
						<span
							className={cn(
								"relative inline-flex size-2 rounded-full",
								status.connected ? "bg-green-500" : "bg-red-500",
							)}
						/>
					</span>
					<span className="hidden sm:inline font-medium">
						{status.connected ? "AI" : "AI Off"}
					</span>
					{status.connected && status.modelsLoaded.length > 0 && (
						<Badge
							variant="secondary"
							className="text-[9px] px-1 py-0 h-3.5 font-mono"
						>
							{status.modelsLoaded.length}
						</Badge>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				className="w-80 p-0"
			>
				<div className="flex flex-col">
					{/* Header */}
					<div className="flex items-center justify-between px-3 py-2.5 border-b">
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								icon={SparklesIcon}
								className={cn(
									"size-4",
									status.connected
										? "text-primary"
										: "text-red-400",
								)}
							/>
							<span className="text-sm font-semibold">
								AI Monitor
							</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span
								className={cn(
									"size-2 rounded-full",
									status.connected
										? "bg-green-500"
										: "bg-red-500",
								)}
							/>
							<span
								className={cn(
									"text-xs font-medium",
									status.connected
										? "text-green-500"
										: "text-red-400",
								)}
							>
								{status.connected ? "Online" : "Offline"}
							</span>
						</div>
					</div>

					{/* Connected state */}
					{status.connected && (
						<div className="flex flex-col gap-0 divide-y">
							{/* Quick stats row */}
							<div className="grid grid-cols-3 divide-x">
								<StatCell
									label="Uptime"
									value={formatUptime(uptime)}
								/>
								<StatCell
									label="Compute"
									value={
										status.gpuAvailable ? "GPU" : "CPU"
									}
									valueColor={
										status.gpuAvailable
											? "text-green-400"
											: "text-yellow-400"
									}
								/>
								<StatCell
									label="Version"
									value={
										status.backendVersion ?? "0.1.0"
									}
								/>
							</div>

							{/* Memory */}
							{status.memoryTotalMb > 0 && (
								<div className="px-3 py-2.5">
									<div className="flex items-center justify-between mb-1.5">
										<span className="text-[11px] text-muted-foreground">
											Memory
										</span>
										<span className="text-[11px] font-mono tabular-nums">
											{formatMb(status.memoryUsageMb)} /{" "}
											{formatMb(status.memoryTotalMb)}
										</span>
									</div>
									<Progress
										value={memoryPercent}
										className={cn(
											"h-1.5",
											memoryBarColor,
										)}
									/>
								</div>
							)}

							{/* Services */}
							<div className="px-3 py-2.5">
								<div className="flex items-center justify-between mb-2">
									<span className="text-[11px] text-muted-foreground font-medium">
										Services
									</span>
								</div>
								<div className="flex flex-col gap-1">
									{([
										{ key: "ollama" as const, label: "LLM" },
										{ key: "tts" as const, label: "Voice" },
										{ key: "whisper" as const, label: "Whisper" },
										{ key: "image" as const, label: "Image" },
									] as const).map(({ key, label }) => {
										const svc = services[key];
										const isRunning = svc.status === "running";
										const modelLoaded = svc.model_loaded === true;
										const modelInstalled = svc.model_installed !== false;

										// Determine actual readiness
										const ollamaModelName = key === "ollama" && isRunning && Array.isArray(svc.models) && svc.models.length > 0
											? (svc.models[0] as { name: string }).name
											: null;
										const isOllamaReady = key === "ollama" && isRunning && ollamaModelName !== null;
										const isModelService = key !== "ollama";
										const isReady = isModelService
											? isRunning && modelLoaded
											: isOllamaReady;

										const statusText = !isRunning
											? "Offline"
											: key === "ollama"
												? ollamaModelName ? `Online (${ollamaModelName})` : "No model"
												: !modelInstalled
													? "Not installed"
													: modelLoaded
														? "Online"
														: "Not loaded";

										const dotColor = !isRunning
											? "bg-red-500"
											: isReady
												? "bg-green-500"
												: "bg-yellow-500";

										const textColor = !isRunning
											? "text-red-400"
											: isReady
												? "text-green-500"
												: "text-yellow-500";

										return (
											<button
												type="button"
												key={key}
												className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 hover:bg-muted/80 transition-colors cursor-pointer text-left w-full"
												onClick={() => {
													setIsOpen(false);
													onSetupClick?.();
												}}
											>
												<span
													className={cn(
														"size-1.5 rounded-full shrink-0",
														dotColor,
													)}
												/>
												<span className="text-[11px] font-medium flex-1">
													{label}
												</span>
												<span className={cn("text-[10px]", textColor)}>
													{statusText}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							{/* Actions */}
							<div className="px-3 py-2.5 flex items-center gap-2">
								<Button
									size="sm"
									className="flex-1 h-7 text-[11px]"
									onClick={() => {
										setIsOpen(false);
										onSetupClick?.();
									}}
								>
									<HugeiconsIcon
										icon={SparklesIcon}
										className="size-3 mr-1"
									/>
									Manage AI services
									<HugeiconsIcon
										icon={ArrowRight01Icon}
										className="size-3 ml-auto"
									/>
								</Button>
								{onRefresh && (
									<Button
										size="sm"
										variant="outline"
										className="h-7 text-[11px] px-2.5"
										onClick={onRefresh}
									>
										Refresh
									</Button>
								)}
							</div>
						</div>
					)}

					{/* Disconnected state */}
					{!status.connected && (
						<div className="flex flex-col gap-3 px-3 py-3">
							{/* Error */}
							<div className="rounded-md bg-red-500/10 px-3 py-2.5">
								<p className="text-xs font-medium text-red-400 mb-1">
									{status.errorType === "connection_refused"
										? "AI backend is not running"
										: status.errorType === "timeout"
											? "AI backend is not responding"
											: "Cannot connect to AI backend"}
								</p>
								{status.error && (
									<p className="text-[11px] text-red-400/70 leading-relaxed">
										{status.error}
									</p>
								)}
							</div>

							{/* Quick start */}
							<div className="flex flex-col gap-1.5">
								<span className="text-[11px] text-muted-foreground font-medium">
									Quick start
								</span>
								<code className="text-[11px] font-mono bg-muted rounded px-2.5 py-1.5 text-muted-foreground select-all block">
									docker compose up -d
								</code>
							</div>

							{/* Backend URL */}
							{status.backendUrl && (
								<div className="flex items-center justify-between text-[11px]">
									<span className="text-muted-foreground">
										Target
									</span>
									<code className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">
										{status.backendUrl}
									</code>
								</div>
							)}

							{/* Actions */}
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									className="flex-1 h-8 text-xs"
									onClick={() => {
										setIsOpen(false);
										onSetupClick?.();
									}}
								>
									Open setup guide
								</Button>
								{onRefresh && (
									<Button
										size="sm"
										variant="outline"
										className="h-8 text-xs px-3"
										onClick={onRefresh}
									>
										Retry
									</Button>
								)}
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function StatCell({
	label,
	value,
	valueColor,
}: {
	label: string;
	value: string;
	valueColor?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-0.5 py-2.5 px-2">
			<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</span>
			<span
				className={cn(
					"text-xs font-semibold font-mono tabular-nums",
					valueColor,
				)}
			>
				{value}
			</span>
		</div>
	);
}
