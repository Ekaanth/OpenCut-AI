"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";

import { HugeiconsIcon } from "@hugeicons/react";
import {
	SparklesIcon,
	Tick01Icon,
	ArrowRight01Icon,
	Download04Icon,
} from "@hugeicons/core-free-icons";
import { useAIStatus } from "@/hooks/use-ai-status";
import { aiClient, type ServicesStatus, type ServiceInfo } from "@/lib/ai-client";
import {
	useServiceHealth,
	SERVICE_URLS,
	SERVICE_DOCKER_COMMANDS,
	type ServiceHealth,
	type ServiceName,
} from "@/hooks/use-service-health";

// ----- Types -----

interface AISetupGuideProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

type ServiceState = "running" | "stopped" | "loaded" | "available" | "not_installed" | "loading" | "error";

interface OllamaModel {
	name: string;
	size: number;
	modified_at: string;
}

// ----- Helpers -----

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
	if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
	return `${(bytes / 1024).toFixed(0)} KB`;
}

function statusBadge(status: ServiceState): {
	variant: "default" | "secondary" | "destructive" | "outline";
	label: string;
	dotColor: string;
} {
	switch (status) {
		case "running":
		case "loaded":
			return { variant: "default", label: status === "loaded" ? "Loaded" : "Running", dotColor: "bg-green-500" };
		case "available":
			return { variant: "secondary", label: "Not loaded", dotColor: "bg-yellow-500" };
		case "not_installed":
			return { variant: "destructive", label: "Not installed", dotColor: "bg-red-500" };
		case "loading":
			return { variant: "outline", label: "Loading...", dotColor: "bg-yellow-500" };
		case "stopped":
			return { variant: "destructive", label: "Stopped", dotColor: "bg-red-500" };
		case "error":
			return { variant: "destructive", label: "Error", dotColor: "bg-red-500" };
	}
}

const SUGGESTED_MODELS = [
	{ name: "llama3.2:3b", description: "Fast, lightweight — good for commands and analysis", size: "~2 GB" },
	{ name: "llama3.2:1b", description: "Fastest, minimal resources", size: "~1.3 GB" },
	{ name: "mistral:7b", description: "High quality, needs more RAM", size: "~4.1 GB" },
];

// ----- Component -----

export function AISetupGuide({ isOpen, onOpenChange }: AISetupGuideProps) {
	const { isConnected, refresh } = useAIStatus();
	const { services, isChecking, checkAll, loadModel, verifyModel } = useServiceHealth(isOpen);
	const [isPullingModel, setIsPullingModel] = useState<string | null>(null);
	const [isPreparingWhisper, setIsPreparingWhisper] = useState(false);
	const [isPreparingTTS, setIsPreparingTTS] = useState(false);
	const [isPreparingDiffusion, setIsPreparingDiffusion] = useState(false);
	const [isVerifying, setIsVerifying] = useState<string | null>(null);
	const [pullError, setPullError] = useState<string | null>(null);
	const [whisperError, setWhisperError] = useState<string | null>(null);
	const [ttsError, setTtsError] = useState<string | null>(null);
	const [diffusionError, setDiffusionError] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);

	const isLoading = isChecking;

	// Re-fetch when dialog opens
	useEffect(() => {
		if (isOpen) {
			checkAll();
		}
	}, [isOpen, checkAll]);

	const handleRefresh = useCallback(async () => {
		await refresh();
		await checkAll();
	}, [refresh, checkAll]);

	const handleVerify = useCallback(async (service: "whisper" | "tts" | "image", label: string) => {
		setIsVerifying(service);
		setActionMessage(null);
		try {
			const result = await verifyModel(service);
			if (result.isLoaded) {
				setActionMessage(`${label} model verified — working correctly.`);
			} else {
				// Set the appropriate error
				const errorMsg = result.detail ?? `${label} model is not loaded. Try downloading it again.`;
				if (service === "whisper") setWhisperError(errorMsg);
				if (service === "tts") setTtsError(errorMsg);
				if (service === "image") setDiffusionError(errorMsg);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Verification failed";
			if (service === "whisper") setWhisperError(msg);
			if (service === "tts") setTtsError(msg);
			if (service === "image") setDiffusionError(msg);
		} finally {
			setIsVerifying(null);
		}
	}, [verifyModel]);

	const handlePullModel = useCallback(async (modelName: string) => {
		setIsPullingModel(modelName);
		setPullError(null);
		setActionMessage(null);
		try {
			await aiClient.pullOllamaModel(modelName);
			setActionMessage(`Model "${modelName}" pulled successfully.`);
			await checkAll();
		} catch (error) {
			setPullError(error instanceof Error ? error.message : "Failed to pull model");
		} finally {
			setIsPullingModel(null);
		}
	}, [checkAll]);

	const handlePrepareWhisper = useCallback(async () => {
		setIsPreparingWhisper(true);
		setWhisperError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("whisper");
			if (result.verified) {
				setActionMessage("Whisper model loaded and verified.");
			} else {
				setWhisperError("Model was downloaded but could not be verified as loaded. Click 'Verify' to re-check.");
			}
		} catch (error) {
			setWhisperError(error instanceof Error ? error.message : "Failed to prepare Whisper. The service may not be running.");
		} finally {
			setIsPreparingWhisper(false);
		}
	}, [loadModel]);

	const handlePrepareTTS = useCallback(async () => {
		setIsPreparingTTS(true);
		setTtsError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("tts");
			if (result.verified) {
				setActionMessage("TTS model loaded and verified.");
			} else {
				setTtsError("Model was downloaded but could not be verified as loaded. Click 'Verify' to re-check.");
			}
		} catch (error) {
			setTtsError(error instanceof Error ? error.message : "Failed to load TTS model. The service may not be running.");
		} finally {
			setIsPreparingTTS(false);
		}
	}, [loadModel]);

	const handlePrepareDiffusion = useCallback(async () => {
		setIsPreparingDiffusion(true);
		setDiffusionError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("image");
			if (result.verified) {
				setActionMessage("Image generation model loaded and verified.");
			} else {
				setDiffusionError("Model was downloaded but could not be verified as loaded. Click 'Verify' to re-check.");
			}
		} catch (error) {
			setDiffusionError(error instanceof Error ? error.message : "Failed to load diffusion model. The service may not be running.");
		} finally {
			setIsPreparingDiffusion(false);
		}
	}, [loadModel]);

	const backend = services.backend;
	const ollama = services.ollama;
	const whisper = services.whisper;
	const tts = services.tts;
	const diffusion = services.image;
	const ollamaModels = (ollama?.models ?? []) as OllamaModel[];

	const isBackendRunning = backend.status === "running";
	const isOllamaRunning = ollama.status === "running";
	const isWhisperRunning = whisper.status === "running";
	const isTTSRunning = tts.status === "running";
	const isImageRunning = diffusion.status === "running";
	const hasModels = ollamaModels.length > 0;

	// Count how many services are ready
	const readyCount = [
		isBackendRunning,
		isOllamaRunning,
		hasModels,
		isWhisperRunning,
		isTTSRunning,
		isImageRunning,
	].filter(Boolean).length;
	const totalServices = 5; // backend, ollama, whisper, tts, image

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={SparklesIcon} className="size-5 text-primary" />
						AI Setup
					</DialogTitle>
					<DialogDescription>
						Manage AI services, models, and verify everything is ready.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="flex-1 -mx-6 px-6">
					<div className="flex flex-col gap-4 pb-2">

						{/* ── Overall Status ── */}
						<div
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs",
								readyCount >= totalServices
									? "bg-green-500/10 text-green-400"
									: readyCount > 0
										? "bg-yellow-500/10 text-yellow-400"
										: "bg-red-500/10 text-red-400",
							)}
						>
							<span
								className={cn(
									"size-2.5 rounded-full shrink-0",
									readyCount >= totalServices
										? "bg-green-500"
										: readyCount > 0 ? "bg-yellow-500" : "bg-red-500",
								)}
							/>
							<div className="flex-1">
								{readyCount >= totalServices ? (
									<span className="font-medium">All {totalServices} services running</span>
								) : readyCount > 0 ? (
									<span className="font-medium">
										{readyCount}/{totalServices} services running
									</span>
								) : (
									<div>
										<span className="font-medium">No services running</span>
										<p className="text-[11px] mt-0.5 opacity-80">
											Start all with: <code className="font-mono bg-black/20 px-1 rounded">docker compose up -d</code>
										</p>
									</div>
								)}
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRefresh}
								disabled={isLoading}
								className="h-6 text-[11px] px-2 shrink-0"
							>
								{isLoading ? <Spinner className="size-3" /> : "Refresh"}
							</Button>
						</div>

						{/* ── 1. Docker / Backend Service ── */}
						<ServiceCard
							title="AI Backend"
							status={isBackendRunning ? "running" : "stopped"}
							detail={isBackendRunning ? `v${backend?.version ?? "0.1.0"} on port 8420` : SERVICE_URLS.backend}
						>
							{!isBackendRunning && (
								<div className="flex flex-col gap-2 mt-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										The AI backend gateway powers all AI features. Start it using Docker:
									</p>
									<div className="flex flex-col gap-1">
										<CommandBlock label="Start all services" command="docker compose up -d" />
										<CommandBlock label="Or start backend only" command={SERVICE_DOCKER_COMMANDS.backend} />
									</div>
								</div>
							)}
						</ServiceCard>

						{/* ── 2. Ollama LLM Service ── */}
						<ServiceCard
							title="Ollama (LLM)"
							status={isOllamaRunning ? "running" : "stopped"}
							detail={isOllamaRunning
								? `${ollamaModels.length} ${ollamaModels.length === 1 ? "model" : "models"} installed`
								: SERVICE_URLS.ollama
							}
						>
							{!isOllamaRunning && (
								<div className="mt-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Ollama serves local LLMs for AI commands, chapter detection, and analysis. Start it:
									</p>
									<CommandBlock label="Via Docker" command={SERVICE_DOCKER_COMMANDS.ollama} />
									<CommandBlock label="Or install locally" command="brew install ollama && ollama serve" />
								</div>
							)}

							{isOllamaRunning && (
								<div className="mt-2 flex flex-col gap-2">
									{/* Installed models */}
									{ollamaModels.length > 0 && (
										<div className="flex flex-col gap-1">
											<span className="text-[11px] text-muted-foreground font-medium">Installed models</span>
											{ollamaModels.map((model) => (
												<div
													key={model.name}
													className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5 text-[11px]"
												>
													<div className="flex items-center gap-1.5">
														<span className="size-1.5 rounded-full bg-green-500" />
														<span className="font-medium">{model.name}</span>
													</div>
													<span className="text-muted-foreground tabular-nums">
														{formatBytes(model.size)}
													</span>
												</div>
											))}
										</div>
									)}

									{/* Pull a new model */}
									{!hasModels && (
										<div className="rounded bg-yellow-500/10 px-2.5 py-2 text-[11px] text-yellow-400">
											No models installed yet. Pull one to enable AI commands.
										</div>
									)}

									<div className="flex flex-col gap-1">
										<span className="text-[11px] text-muted-foreground font-medium">
											{hasModels ? "Add more models" : "Choose a model to install"}
										</span>
										{SUGGESTED_MODELS.map((model) => {
											const isInstalled = ollamaModels.some(
												(m) => m.name === model.name || m.name.startsWith(model.name.split(":")[0]),
											);
											const isPulling = isPullingModel === model.name;

											return (
												<div
													key={model.name}
													className="flex items-center gap-2 rounded bg-muted/30 px-2.5 py-2 text-[11px]"
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="font-medium font-mono">{model.name}</span>
															<span className="text-muted-foreground">{model.size}</span>
															{isInstalled && (
																<Badge variant="secondary" className="text-[9px] px-1 py-0">
																	Installed
																</Badge>
															)}
														</div>
														<p className="text-muted-foreground mt-0.5">{model.description}</p>
													</div>
													{!isInstalled && (
														<Button
															size="sm"
															variant="outline"
															className="h-6 text-[10px] px-2 shrink-0"
															disabled={isPulling || isPullingModel !== null}
															onClick={() => handlePullModel(model.name)}
														>
															{isPulling ? (
																<>
																	<Spinner className="size-3 mr-1" />
																	Pulling...
																</>
															) : (
																<>
																	<HugeiconsIcon icon={Download04Icon} className="size-3 mr-0.5" />
																	Pull
																</>
															)}
														</Button>
													)}
												</div>
											);
										})}
									</div>

									{pullError && (
										<p className="text-[11px] text-destructive">{pullError}</p>
									)}
								</div>
							)}
						</ServiceCard>

						{/* ── 3. TTS (Voice Generation) ── */}
						<ServiceCard
							title="Voice (TTS)"
							status={isTTSRunning
								? tts.model_loaded
									? "loaded"
									: tts.model_installed === false
										? "not_installed"
										: "available"
								: "stopped"
							}
							detail={
								!isTTSRunning
									? SERVICE_URLS.tts
									: tts.model_loaded
										? "Model loaded — voice generation ready"
										: tts.model_installed === false
											? "Model not downloaded — install to enable"
											: "Model not loaded"
							}
						>
							{!isTTSRunning && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										TTS service is not running. Start it with Docker:
									</p>
									<CommandBlock label="Start TTS" command={SERVICE_DOCKER_COMMANDS.tts} />
								</div>
							)}
							{isTTSRunning && !tts.model_loaded && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Service is running but the TTS model needs to be loaded or installed.
									</p>
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											className="h-7 text-[11px]"
											disabled={isPreparingTTS}
											onClick={handlePrepareTTS}
										>
											{isPreparingTTS ? (
												<>
													<Spinner className="size-3 mr-1" />
													Loading TTS model...
												</>
											) : (
												<>
													<HugeiconsIcon icon={Download04Icon} className="size-3 mr-1" />
													Load model
												</>
											)}
										</Button>
									</div>
									{ttsError && (
										<p className="text-[11px] text-destructive">{ttsError}</p>
									)}
								</div>
							)}
							{isTTSRunning && tts.model_loaded && (
								<div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
									<HugeiconsIcon icon={Tick01Icon} className="size-3 text-green-400" />
									<span className="text-green-400 flex-1">Voice generation and cloning are available</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 text-muted-foreground"
										disabled={isVerifying === "tts"}
										onClick={() => handleVerify("tts", "TTS")}
									>
										{isVerifying === "tts" ? <Spinner className="size-2.5" /> : "Verify"}
									</Button>
								</div>
							)}
							{ttsError && isTTSRunning && tts.model_loaded && (
								<div className="mt-1 rounded bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 flex items-start gap-2">
									<span className="flex-1">{ttsError}</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 shrink-0"
										onClick={handlePrepareTTS}
										disabled={isPreparingTTS}
									>
										Re-download
									</Button>
								</div>
							)}
						</ServiceCard>

						{/* ── 4. Whisper (Transcription) ── */}
						<ServiceCard
							title="Whisper (Transcription)"
							status={isWhisperRunning
								? (whisper.model_loaded ? "loaded" : "available")
								: "stopped"
							}
							detail={
								!isWhisperRunning
									? SERVICE_URLS.whisper
									: whisper.model_loaded
										? `Model "${whisper.model_size ?? "base"}" loaded`
										: "Model not loaded"
							}
						>
							{!isWhisperRunning && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Whisper service is not running. Start it with Docker:
									</p>
									<CommandBlock label="Start Whisper" command={SERVICE_DOCKER_COMMANDS.whisper} />
								</div>
							)}
							{isWhisperRunning && !whisper.model_loaded && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Service is running but no model is loaded. Load the model to enable transcription.
									</p>
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											className="h-7 text-[11px]"
											disabled={isPreparingWhisper}
											onClick={handlePrepareWhisper}
										>
											{isPreparingWhisper ? (
												<>
													<Spinner className="size-3 mr-1" />
													Loading model...
												</>
											) : (
												<>
													<HugeiconsIcon icon={Download04Icon} className="size-3 mr-1" />
													Load model
												</>
											)}
										</Button>
									</div>
									{whisperError && (
										<p className="text-[11px] text-destructive">{whisperError}</p>
									)}
								</div>
							)}
							{isWhisperRunning && whisper.model_loaded && (
								<div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
									<HugeiconsIcon icon={Tick01Icon} className="size-3 text-green-400" />
									<span className="text-green-400 flex-1">Model ready — transcription is available</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 text-muted-foreground"
										disabled={isVerifying === "whisper"}
										onClick={() => handleVerify("whisper", "Whisper")}
									>
										{isVerifying === "whisper" ? <Spinner className="size-2.5" /> : "Verify"}
									</Button>
								</div>
							)}
							{whisperError && isWhisperRunning && whisper.model_loaded && (
								<div className="mt-1 rounded bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 flex items-start gap-2">
									<span className="flex-1">{whisperError}</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 shrink-0"
										onClick={handlePrepareWhisper}
										disabled={isPreparingWhisper}
									>
										Re-download
									</Button>
								</div>
							)}
						</ServiceCard>

						{/* ── 5. Image Generation ── */}
						<ServiceCard
							title="Image Generation"
							status={isImageRunning
								? diffusion.model_loaded
									? "loaded"
									: diffusion.model_installed === false
										? "not_installed"
										: "available"
								: "stopped"
							}
							detail={
								!isImageRunning
									? SERVICE_URLS.image
									: diffusion.model_loaded
										? "Model loaded — image generation ready"
										: diffusion.model_installed === false
											? "Model not downloaded — install to enable"
											: "Model not loaded"
							}
						>
							{!isImageRunning && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Image service is not running. Start it with Docker:
									</p>
									<CommandBlock label="Start Image service" command={SERVICE_DOCKER_COMMANDS.image} />
								</div>
							)}
							{isImageRunning && !diffusion.model_loaded && (
								<div className="mt-2 flex flex-col gap-2">
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Service is running but the image model needs to be loaded or installed. GPU recommended.
									</p>
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											className="h-7 text-[11px]"
											disabled={isPreparingDiffusion}
											onClick={handlePrepareDiffusion}
										>
											{isPreparingDiffusion ? (
												<>
													<Spinner className="size-3 mr-1" />
													Loading image model...
												</>
											) : (
												<>
													<HugeiconsIcon icon={Download04Icon} className="size-3 mr-1" />
													Load model
												</>
											)}
										</Button>
									</div>
									{diffusionError && (
										<p className="text-[11px] text-destructive">{diffusionError}</p>
									)}
								</div>
							)}
							{isImageRunning && diffusion.model_loaded && (
								<div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
									<HugeiconsIcon icon={Tick01Icon} className="size-3 text-green-400" />
									<span className="text-green-400 flex-1">Image generation is available</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 text-muted-foreground"
										disabled={isVerifying === "image"}
										onClick={() => handleVerify("image", "Image")}
									>
										{isVerifying === "image" ? <Spinner className="size-2.5" /> : "Verify"}
									</Button>
								</div>
							)}
							{diffusionError && isImageRunning && diffusion.model_loaded && (
								<div className="mt-1 rounded bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 flex items-start gap-2">
									<span className="flex-1">{diffusionError}</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-5 text-[10px] px-1.5 shrink-0"
										onClick={handlePrepareDiffusion}
										disabled={isPreparingDiffusion}
									>
										Re-download
									</Button>
								</div>
							)}
						</ServiceCard>

						{/* ── Success message ── */}
						{actionMessage && (
							<div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-[11px] text-green-400">
								<HugeiconsIcon icon={Tick01Icon} className="size-3.5 shrink-0" />
								{actionMessage}
							</div>
						)}

					</div>
				</ScrollArea>

				<DialogFooter>
					{readyCount >= totalServices ? (
						<Button onClick={() => onOpenChange(false)}>
							Get started
							<HugeiconsIcon icon={ArrowRight01Icon} className="!size-3.5 ml-1" />
						</Button>
					) : (
						<div className="flex items-center gap-2 w-full">
							<Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
								Close
							</Button>
							<Button onClick={handleRefresh} disabled={isLoading} className="flex-1">
								{isLoading ? (
									<>
										<Spinner className="size-3 mr-1" />
										Checking...
									</>
								) : (
									"Check all services"
								)}
							</Button>
						</div>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ----- Sub-components -----

function ServiceCard({
	title,
	status,
	detail,
	children,
}: {
	title: string;
	status: ServiceState;
	detail: string;
	children?: React.ReactNode;
}) {
	const badge = statusBadge(status);

	return (
		<Card className="rounded-lg">
			<CardContent className="p-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className={cn("size-2 rounded-full shrink-0", badge.dotColor)} />
						<span className="text-xs font-medium">{title}</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-[11px] text-muted-foreground">{detail}</span>
						<Badge
							variant={badge.variant}
							className="text-[9px] px-1.5 py-0"
						>
							{badge.label}
						</Badge>
					</div>
				</div>
				{children}
			</CardContent>
		</Card>
	);
}

function CommandBlock({ label, command }: { label: string; command: string }) {
	return (
		<div className="mt-1">
			<span className="text-[10px] text-muted-foreground">{label}:</span>
			<code className="block text-[11px] font-mono bg-muted rounded px-2 py-1 mt-0.5 text-muted-foreground select-all">
				{command}
			</code>
		</div>
	);
}
