"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Tick01Icon,
	Download04Icon,
	CpuIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";

// ----- Types -----

export interface HardwareInfo {
	gpuName: string | null;
	gpuMemoryMb: number;
	ramMb: number;
	diskFreeMb: number;
	cpuCores: number;
	platform: string;
}

export interface ModelTier {
	id: string;
	name: string;
	description: string;
	sizeMb: number;
	models: ModelDownload[];
	recommended?: boolean;
	requirements: {
		minRamMb: number;
		minDiskMb: number;
		gpuRequired: boolean;
	};
}

export interface ModelDownload {
	id: string;
	name: string;
	sizeMb: number;
	description: string;
	progress: number;
	status: "pending" | "downloading" | "complete" | "error";
	error?: string;
}

type WizardStep = "welcome" | "tier" | "download" | "done";

interface ModelWizardProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	hardware: HardwareInfo | null;
	tiers: ModelTier[];
	onDetectHardware: () => Promise<HardwareInfo>;
	onSelectTier: (tierId: string) => void;
	onStartDownload: () => Promise<void>;
	onFinish: () => void;
	isDetecting?: boolean;
	selectedTierId?: string;
	downloadProgress?: ModelDownload[];
	isDownloading?: boolean;
}

// ----- Helpers -----

function formatSize(mb: number): string {
	if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
	return `${mb}MB`;
}

function meetsRequirements(
	hardware: HardwareInfo,
	tier: ModelTier,
): boolean {
	const { requirements } = tier;
	if (requirements.gpuRequired && !hardware.gpuName) return false;
	if (hardware.ramMb < requirements.minRamMb) return false;
	if (hardware.diskFreeMb < requirements.minDiskMb) return false;
	return true;
}

// ----- Steps -----

const STEPS: { key: WizardStep; label: string }[] = [
	{ key: "welcome", label: "Welcome" },
	{ key: "tier", label: "Select Tier" },
	{ key: "download", label: "Download" },
	{ key: "done", label: "Done" },
];

// ----- Component -----

export function ModelWizard({
	isOpen,
	onOpenChange,
	hardware,
	tiers,
	onDetectHardware,
	onSelectTier,
	onStartDownload,
	onFinish,
	isDetecting = false,
	selectedTierId,
	downloadProgress,
	isDownloading = false,
}: ModelWizardProps) {
	const [step, setStep] = useState<WizardStep>("welcome");
	const currentStepIndex = STEPS.findIndex((s) => s.key === step);

	const allDownloadsComplete =
		downloadProgress?.every((d) => d.status === "complete") ?? false;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon
							icon={SparklesIcon}
							className="size-5 text-primary"
						/>
						AI Model Setup
					</DialogTitle>
					<DialogDescription>
						Set up AI models for local inference.
					</DialogDescription>
				</DialogHeader>

				{/* Stepper */}
				<div className="flex items-center gap-1 px-6">
					{STEPS.map((s, i) => (
						<div key={s.key} className="flex items-center flex-1">
							<div className="flex items-center gap-1.5 flex-1">
								<div
									className={cn(
										"flex items-center justify-center size-6 rounded-full text-[10px] font-medium border transition-colors",
										i < currentStepIndex &&
											"bg-primary text-primary-foreground border-primary",
										i === currentStepIndex &&
											"bg-primary text-primary-foreground border-primary",
										i > currentStepIndex &&
											"bg-accent text-muted-foreground border-border",
									)}
								>
									{i < currentStepIndex ? (
										<HugeiconsIcon
											icon={Tick01Icon}
											className="size-3"
										/>
									) : (
										i + 1
									)}
								</div>
								<span
									className={cn(
										"text-[10px] hidden sm:inline",
										i === currentStepIndex
											? "text-foreground font-medium"
											: "text-muted-foreground",
									)}
								>
									{s.label}
								</span>
							</div>
							{i < STEPS.length - 1 && (
								<div
									className={cn(
										"h-px flex-1 mx-1",
										i < currentStepIndex
											? "bg-primary"
											: "bg-border",
									)}
								/>
							)}
						</div>
					))}
				</div>

				<DialogBody>
					{/* Step 1: Welcome / Hardware detection */}
					{step === "welcome" && (
						<div className="flex flex-col gap-4">
							<p className="text-sm text-muted-foreground">
								OpenCut AI runs models locally on your machine for maximum
								privacy and speed. Let&apos;s detect your hardware to find
								the best configuration.
							</p>

							{hardware ? (
								<Card className="rounded-lg">
									<CardContent className="p-4">
										<div className="flex items-center gap-2 mb-3">
											<HugeiconsIcon
												icon={CpuIcon}
												className="size-4 text-primary"
											/>
											<span className="text-sm font-medium">
												Hardware Detected
											</span>
										</div>
										<div className="grid grid-cols-2 gap-2 text-xs">
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													GPU
												</span>
												<span>
													{hardware.gpuName ?? "Not available"}
												</span>
											</div>
											{hardware.gpuMemoryMb > 0 && (
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														VRAM
													</span>
													<span>
														{formatSize(hardware.gpuMemoryMb)}
													</span>
												</div>
											)}
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													RAM
												</span>
												<span>{formatSize(hardware.ramMb)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Disk Free
												</span>
												<span>
													{formatSize(hardware.diskFreeMb)}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													CPU Cores
												</span>
												<span>{hardware.cpuCores}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Platform
												</span>
												<span>{hardware.platform}</span>
											</div>
										</div>
									</CardContent>
								</Card>
							) : (
								<Button
									onClick={onDetectHardware}
									disabled={isDetecting}
									variant="outline"
									className="self-center"
								>
									{isDetecting ? (
										<>
											<Spinner className="size-3 mr-1" />
											Detecting...
										</>
									) : (
										<>
											<HugeiconsIcon
												icon={CpuIcon}
												className="size-3 mr-1"
											/>
											Detect Hardware
										</>
									)}
								</Button>
							)}
						</div>
					)}

					{/* Step 2: Tier selection */}
					{step === "tier" && (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Choose a model tier based on your hardware and needs.
							</p>
							{tiers.map((tier) => {
								const canRun = hardware
									? meetsRequirements(hardware, tier)
									: true;

								return (
									<Card
										key={tier.id}
										className={cn(
											"cursor-pointer transition-all rounded-lg",
											selectedTierId === tier.id &&
												"ring-2 ring-primary",
											!canRun && "opacity-50 cursor-not-allowed",
											canRun && "hover:bg-accent",
										)}
										onClick={() => canRun && onSelectTier(tier.id)}
									>
										<CardContent className="p-4">
											<div className="flex items-start justify-between">
												<div>
													<div className="flex items-center gap-2">
														<span className="text-sm font-medium">
															{tier.name}
														</span>
														{tier.recommended && (
															<Badge
																variant="default"
																className="text-[10px] px-1.5 py-0"
															>
																Recommended
															</Badge>
														)}
														{!canRun && (
															<Badge
																variant="destructive"
																className="text-[10px] px-1.5 py-0"
															>
																Insufficient hardware
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground mt-1">
														{tier.description}
													</p>
												</div>
												<span className="text-xs text-muted-foreground tabular-nums shrink-0">
													~{formatSize(tier.sizeMb)}
												</span>
											</div>
											<div className="flex flex-wrap gap-1 mt-2">
												{tier.models.map((model) => (
													<Badge
														key={model.id}
														variant="secondary"
														className="text-[10px]"
													>
														{model.name}
													</Badge>
												))}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}

					{/* Step 3: Download */}
					{step === "download" && (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Downloading models. This may take a while depending on
								your connection.
							</p>
							{downloadProgress?.map((model) => (
								<div key={model.id} className="flex flex-col gap-1.5">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-xs font-medium">
												{model.name}
											</span>
											<span className="text-[10px] text-muted-foreground">
												{formatSize(model.sizeMb)}
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											{model.status === "complete" && (
												<HugeiconsIcon
													icon={Tick01Icon}
													className="size-3 text-green-500"
												/>
											)}
											{model.status === "downloading" && (
												<span className="text-[10px] text-muted-foreground tabular-nums">
													{Math.round(model.progress)}%
												</span>
											)}
											{model.status === "error" && (
												<span className="text-[10px] text-destructive">
													Error
												</span>
											)}
										</div>
									</div>
									<Progress
										value={
											model.status === "complete" ? 100 : model.progress
										}
										className={cn(
											"h-1.5",
											model.status === "error" &&
												"[&>div]:bg-destructive",
										)}
									/>
									{model.error && (
										<p className="text-[10px] text-destructive">
											{model.error}
										</p>
									)}
								</div>
							))}
						</div>
					)}

					{/* Step 4: Done */}
					{step === "done" && (
						<div className="flex flex-col items-center gap-4 py-4">
							<div className="flex items-center justify-center size-16 rounded-full bg-green-500/10">
								<HugeiconsIcon
									icon={Tick01Icon}
									className="size-8 text-green-500"
								/>
							</div>
							<div className="text-center">
								<p className="text-sm font-medium">
									AI models are ready!
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									All models have been downloaded and are ready to use.
									You can manage them in Settings.
								</p>
							</div>
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					{step === "welcome" && (
						<>
							<Button
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Skip
							</Button>
							<Button
								onClick={() => setStep("tier")}
								disabled={!hardware}
							>
								Continue
							</Button>
						</>
					)}
					{step === "tier" && (
						<>
							<Button
								variant="outline"
								onClick={() => setStep("welcome")}
							>
								Back
							</Button>
							<Button
								onClick={() => {
									setStep("download");
									onStartDownload();
								}}
								disabled={!selectedTierId}
							>
								<HugeiconsIcon
									icon={Download04Icon}
									className="size-3 mr-1"
								/>
								Download Models
							</Button>
						</>
					)}
					{step === "download" && (
						<>
							<Button
								variant="outline"
								onClick={() => setStep("tier")}
								disabled={isDownloading}
							>
								Back
							</Button>
							<Button
								onClick={() => setStep("done")}
								disabled={!allDownloadsComplete}
							>
								Continue
							</Button>
						</>
					)}
					{step === "done" && (
						<Button onClick={onFinish}>Get Started</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
