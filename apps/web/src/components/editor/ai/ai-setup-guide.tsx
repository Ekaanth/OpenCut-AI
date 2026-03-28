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
import { toast } from "sonner";
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
	{ name: "llama3.2:1b", description: "Fastest, minimal resources", size: "~1.3 GB", device: "cpu" as const, turboquant: true },
	{ name: "llama3.2:3b", description: "Fast, lightweight — good for commands and analysis", size: "~2 GB", device: "cpu" as const, turboquant: true },
	{ name: "mistral:7b", description: "High quality, needs more RAM", size: "~4.1 GB", device: "cpu" as const, turboquant: true },
	{ name: "llama3.1:8b", description: "Best quality Llama, needs 8+ GB", size: "~4.9 GB", device: "gpu" as const, turboquant: true },
	{ name: "qwen2.5:3b", description: "Strong multilingual, TurboQuant validated", size: "~2 GB", device: "cpu" as const, turboquant: true },
	{ name: "qwen2.5:7b", description: "Excellent quality, multilingual", size: "~4.7 GB", device: "gpu" as const, turboquant: true },
	{ name: "phi3.5:3.8b", description: "Microsoft Phi — 128K context, compact", size: "~2.2 GB", device: "cpu" as const, turboquant: true },
	{ name: "gemma2:2b", description: "Google Gemma — efficient and fast", size: "~1.6 GB", device: "cpu" as const, turboquant: true },
];

const SUGGESTED_TTS_MODELS = [
	{ name: "xtts_v2", description: "Best quality — multilingual, voice cloning", size: "~1.8 GB", device: "cpu" as const, multilingual: true, voiceCloning: true },
	{ name: "your_tts", description: "Multilingual, voice cloning, lighter", size: "~290 MB", device: "cpu" as const, multilingual: true, voiceCloning: true },
	{ name: "kitten_tts", description: "Fast, expressive — small footprint", size: "~500 MB", device: "cpu" as const, multilingual: false, voiceCloning: false },
	{ name: "vits-en", description: "English only — fast and lightweight", size: "~110 MB", device: "cpu" as const, multilingual: false, voiceCloning: false },
	{ name: "vits-en-multi", description: "English multi-speaker", size: "~140 MB", device: "cpu" as const, multilingual: false, voiceCloning: false },
	{ name: "tacotron2-en", description: "English — classic, reliable", size: "~130 MB", device: "cpu" as const, multilingual: false, voiceCloning: false },
];

const SUGGESTED_WHISPER_MODELS = [
	{ name: "tiny", description: "Fastest — minimal accuracy", size: "~75 MB", device: "cpu" as const },
	{ name: "base", description: "Good balance of speed and accuracy", size: "~140 MB", device: "cpu" as const },
	{ name: "small", description: "Better accuracy, moderate speed", size: "~460 MB", device: "cpu" as const },
	{ name: "medium", description: "High accuracy, slower", size: "~1.5 GB", device: "cpu" as const },
	{ name: "large-v3", description: "Best accuracy — needs 4+ GB", size: "~3 GB", device: "gpu" as const },
];

const SUGGESTED_IMAGE_MODELS = [
	{ name: "stable-diffusion-2-1", description: "Good quality — versatile default", size: "~5 GB", device: "gpu" as const },
	{ name: "sdxl-turbo", description: "Fast SDXL — 1-4 step generation", size: "~7 GB", device: "gpu" as const },
	{ name: "sdxl-base", description: "Highest quality — SDXL 1.0", size: "~7 GB", device: "gpu" as const },
	{ name: "sd-1.5", description: "Classic SD 1.5 — huge ecosystem", size: "~4 GB", device: "gpu" as const },
	{ name: "flux-schnell", description: "FLUX.1 Schnell — fast, high quality", size: "~12 GB", device: "gpu" as const },
	{ name: "segmind-tiny", description: "Tiny SD — CPU-friendly, compact", size: "~1 GB", device: "cpu" as const },
	{ name: "small-sd", description: "Small SD — runs on CPU, decent quality", size: "~1.5 GB", device: "cpu" as const },
];

// ----- Component -----

export function AISetupGuide({ isOpen, onOpenChange }: AISetupGuideProps) {
	const { isConnected, refresh } = useAIStatus();
	const { services, isChecking, checkAll, loadModel, testModel } = useServiceHealth(isOpen);
	const [isPullingModel, setIsPullingModel] = useState<string | null>(null);
	const [activeModel, setActiveModel] = useState<string>("");
	const [isSwitchingModel, setIsSwitchingModel] = useState(false);
	const [pullError, setPullError] = useState<string | null>(null);
	const [whisperError, setWhisperError] = useState<string | null>(null);
	const [ttsError, setTtsError] = useState<string | null>(null);
	const [diffusionError, setDiffusionError] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [activeTTSModel, setActiveTTSModel] = useState<string>("");
	const [activeTTSDevice, setActiveTTSDevice] = useState<string>("cpu");
	const [isSwitchingTTS, setIsSwitchingTTS] = useState<string | null>(null);
	const [activeWhisperModel, setActiveWhisperModel] = useState<string>("");
	const [activeWhisperDevice, setActiveWhisperDevice] = useState<string>("cpu");
	const [isSwitchingWhisper, setIsSwitchingWhisper] = useState<string | null>(null);
	const [activeImageModel, setActiveImageModel] = useState<string>("");
	const [activeImageDevice, setActiveImageDevice] = useState<string>("cpu");
	const [isSwitchingImage, setIsSwitchingImage] = useState<string | null>(null);
	const [isTestingService, setIsTestingService] = useState<string | null>(null);

	const isLoading = isChecking;

	// Re-fetch when dialog opens
	useEffect(() => {
		if (isOpen) {
			checkAll();
			aiClient.llmStatus().then((data) => {
				if (data.default_model) setActiveModel(data.default_model);
			}).catch(() => {});
			// Fetch active TTS model + device
			fetch(`${SERVICE_URLS.tts}/models`, { signal: AbortSignal.timeout(5000) })
				.then((r) => r.ok ? r.json() : null)
				.then((d) => {
					if (d?.active_model) setActiveTTSModel(d.active_model);
					if (d?.device) setActiveTTSDevice(d.device);
				})
				.catch(() => {});
			// Fetch active Whisper model + device
			fetch(`${SERVICE_URLS.whisper}/health`, { signal: AbortSignal.timeout(5000) })
				.then((r) => r.ok ? r.json() : null)
				.then((d) => {
					const size = d?.model?.model_size;
					if (size) setActiveWhisperModel(size);
					if (d?.model?.device) setActiveWhisperDevice(d.model.device);
				})
				.catch(() => {});
			// Fetch active Image model + device
			fetch(`${SERVICE_URLS.image}/models`, { signal: AbortSignal.timeout(5000) })
				.then((r) => r.ok ? r.json() : null)
				.then((d) => {
					if (d?.active_model) setActiveImageModel(d.active_model);
					if (d?.device) setActiveImageDevice(d.device);
				})
				.catch(() => {});
		}
	}, [isOpen, checkAll]);

	const handleSwitchModel = useCallback(async (modelName: string) => {
		setIsSwitchingModel(true);
		try {
			const result = await aiClient.setLLMModel(modelName);
			setActiveModel(result.current_model);
			toast.success(`Switched to ${modelName}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to switch model");
		} finally {
			setIsSwitchingModel(false);
		}
	}, []);

	const handleRefresh = useCallback(async () => {
		await refresh();
		await checkAll();
	}, [refresh, checkAll]);

	const handlePullModel = useCallback(async (modelName: string) => {
		setIsPullingModel(modelName);
		setPullError(null);
		setActionMessage(null);
		try {
			await aiClient.pullOllamaModel(modelName);
			setActionMessage(`Model "${modelName}" pulled successfully. Switching to it...`);
			await checkAll();
			// Auto-switch to the newly pulled model
			try {
				const result = await aiClient.setLLMModel(modelName);
				setActiveModel(result.current_model);
				setActionMessage(`Model "${modelName}" pulled and activated.`);
				toast.success(`Now using ${modelName}`);
			} catch {
				// Switch failed but download succeeded — that's fine
				setActionMessage(`Model "${modelName}" pulled. Select it above to use it.`);
			}
		} catch (error) {
			setPullError(error instanceof Error ? error.message : "Failed to pull model");
		} finally {
			setIsPullingModel(null);
		}
	}, [checkAll]);

	const handleSwitchTTSModel = useCallback(async (modelName: string) => {
		setIsSwitchingTTS(modelName);
		setTtsError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("tts", { model_name: modelName });
			if (result.verified) {
				setActiveTTSModel(modelName);
				setActionMessage(`TTS switched to ${modelName}`);
				toast.success(`TTS now using ${modelName}`);
				// Refresh device info
				fetch(`${SERVICE_URLS.tts}/models`, { signal: AbortSignal.timeout(5000) })
					.then((r) => r.ok ? r.json() : null)
					.then((d) => { if (d?.device) setActiveTTSDevice(d.device); })
					.catch(() => {});
			} else {
				setTtsError("Model loaded but could not be verified. Try again.");
			}
		} catch (error) {
			setTtsError(error instanceof Error ? error.message : "Failed to switch TTS model");
		} finally {
			setIsSwitchingTTS(null);
		}
	}, [loadModel]);

	const handleSwitchWhisperModel = useCallback(async (modelSize: string) => {
		setIsSwitchingWhisper(modelSize);
		setWhisperError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("whisper", { model_size: modelSize });
			if (result.verified) {
				setActiveWhisperModel(modelSize);
				setActionMessage(`Whisper switched to ${modelSize}`);
				toast.success(`Whisper now using ${modelSize}`);
			} else {
				setWhisperError("Model loaded but could not be verified. Click 'Verify' to re-check.");
			}
		} catch (error) {
			setWhisperError(error instanceof Error ? error.message : "Failed to switch Whisper model");
		} finally {
			setIsSwitchingWhisper(null);
		}
	}, [loadModel]);

	const handleSwitchImageModel = useCallback(async (modelName: string) => {
		setIsSwitchingImage(modelName);
		setDiffusionError(null);
		setActionMessage(null);
		try {
			const result = await loadModel("image", { model_name: modelName });
			if (result.verified) {
				setActiveImageModel(modelName);
				setActionMessage(`Image model switched to ${modelName}`);
				toast.success(`Image model now using ${modelName}`);
				fetch(`${SERVICE_URLS.image}/models`, { signal: AbortSignal.timeout(5000) })
					.then((r) => r.ok ? r.json() : null)
					.then((d) => { if (d?.device) setActiveImageDevice(d.device); })
					.catch(() => {});
			} else {
				setDiffusionError("Model loaded but could not be verified. Try again.");
			}
		} catch (error) {
			setDiffusionError(error instanceof Error ? error.message : "Failed to switch image model");
		} finally {
			setIsSwitchingImage(null);
		}
	}, [loadModel]);

	const handleTestService = useCallback(async (service: "whisper" | "tts" | "image", label: string) => {
		setIsTestingService(service);
		setActionMessage(null);
		try {
			const result = await testModel(service);
			if (result.ok) {
				setActionMessage(result.message ?? `${label} is working correctly.`);
				toast.success(`${label} test passed`);
			} else {
				const errMsg = result.message ?? `${label} test failed.`;
				if (service === "tts") setTtsError(errMsg);
				if (service === "whisper") setWhisperError(errMsg);
				if (service === "image") setDiffusionError(errMsg);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Test failed";
			if (service === "tts") setTtsError(msg);
			if (service === "whisper") setWhisperError(msg);
			if (service === "image") setDiffusionError(msg);
		} finally {
			setIsTestingService(null);
		}
	}, [testModel]);

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

				<ScrollArea className="flex-1">
					<div className="flex flex-col gap-4 px-6 pb-2">

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
									{/* Installed models — with explicit Use / Active button */}
									{ollamaModels.length > 0 && (
										<div className="flex flex-col gap-1">
											<span className="text-[11px] text-muted-foreground font-medium">Installed models</span>
											{ollamaModels.map((model) => {
												const isActive = model.name === activeModel;
												// Determine CPU/GPU from size: models > 4GB typically need GPU
												const modelSizeGB = model.size / 1_073_741_824;
												const deviceTag = modelSizeGB > 4 ? "gpu" : "cpu";
												return (
													<div
														key={model.name}
														className={cn(
															"flex items-center justify-between rounded px-2 py-1.5 text-[11px]",
															isActive
																? "bg-primary/10 border border-primary/30"
																: "bg-muted/50",
														)}
													>
														<div className="flex items-center gap-1.5">
															<span className={cn("size-1.5 rounded-full", isActive ? "bg-primary" : "bg-green-500")} />
															<span className="font-medium">{model.name}</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-[8px] px-1 py-0",
																	deviceTag === "cpu"
																		? "text-green-400 border-green-500/30"
																		: "text-purple-400 border-purple-500/30",
																)}
															>
																{deviceTag === "cpu" ? "CPU" : "GPU"}
															</Badge>
														</div>
														<div className="flex items-center gap-2">
															<span className="text-muted-foreground tabular-nums">
																{formatBytes(model.size)}
															</span>
															{isActive ? (
																<Badge variant="default" className="text-[8px] px-1.5 py-0 h-4">
																	Active
																</Badge>
															) : (
																<Button
																	size="sm"
																	variant="outline"
																	className="h-5 text-[9px] px-2"
																	disabled={isSwitchingModel}
																	onClick={() => handleSwitchModel(model.name)}
																>
																	{isSwitchingModel ? <Spinner className="size-2.5" /> : "Use this"}
																</Button>
															)}
														</div>
													</div>
												);
											})}
										</div>
									)}

									{/* Pull a new model */}
									{!hasModels && (
										<div className="rounded bg-yellow-500/10 px-2.5 py-2 text-[11px] text-yellow-400">
											No models installed yet. Pull one to enable AI commands.
										</div>
									)}

									{ollamaModels.length === 1 && (
										<div className="rounded bg-blue-500/10 px-2.5 py-2 text-[11px] text-blue-400 leading-relaxed">
											To switch models, pull a different one below. It will download and automatically become the active model.
										</div>
									)}

									<div className="flex flex-col gap-1">
										<span className="text-[11px] text-muted-foreground font-medium">
											{hasModels ? "Switch to a different model" : "Choose a model to install"}
										</span>
										{SUGGESTED_MODELS.map((model) => {
											// Exact match: "llama3.2:1b" must match "llama3.2:1b", not "llama3.2:3b"
											const isInstalled = ollamaModels.some(
												(m) => m.name === model.name,
											);
											const isActive = model.name === activeModel;
											const isPulling = isPullingModel === model.name;

											return (
												<div
													key={model.name}
													className={cn(
														"flex items-center gap-2 rounded px-2.5 py-2 text-[11px]",
														isActive
															? "bg-primary/10 border border-primary/30"
															: isInstalled
																? "bg-green-500/5 border border-green-500/20"
																: "bg-muted/30",
													)}
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span className="font-medium font-mono">{model.name}</span>
															<span className="text-muted-foreground">{model.size}</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-[8px] px-1 py-0",
																	model.device === "cpu"
																		? "text-green-400 border-green-500/30"
																		: "text-purple-400 border-purple-500/30",
																)}
															>
																{model.device === "cpu" ? "CPU" : "GPU"}
															</Badge>
															{model.turboquant && (
																<Badge
																	variant="outline"
																	className="text-[8px] px-1 py-0 text-cyan-400 border-cyan-500/30"
																>
																	TurboQuant
																</Badge>
															)}
															{isActive && (
																<Badge variant="default" className="text-[8px] px-1 py-0 h-3.5">
																	Active
																</Badge>
															)}
														</div>
														<p className="text-muted-foreground mt-0.5">{model.description}</p>
													</div>
													<div className="shrink-0">
														{isPulling ? (
															<Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled>
																<Spinner className="size-3 mr-1" />
																Pulling...
															</Button>
														) : isActive ? (
															<Badge variant="default" className="text-[9px] px-1.5 py-0.5">
																In use
															</Badge>
														) : isInstalled ? (
															<Button
																size="sm"
																variant="outline"
																className="h-6 text-[10px] px-2"
																disabled={isSwitchingModel || isPullingModel !== null}
																onClick={() => handleSwitchModel(model.name)}
															>
																{isSwitchingModel ? <Spinner className="size-3" /> : "Use this"}
															</Button>
														) : (
															<Button
																size="sm"
																variant="secondary"
																className="h-6 text-[10px] px-2"
																disabled={isPullingModel !== null}
																onClick={() => handlePullModel(model.name)}
															>
																<HugeiconsIcon icon={Download04Icon} className="size-3 mr-0.5" />
																Pull & Use
															</Button>
														)}
													</div>
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
										? `${activeTTSModel || tts.model_name || "xtts_v2"} loaded`
										: tts.model_installed === false
											? "Not installed"
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

							{isTTSRunning && (
								<div className="mt-2 flex flex-col gap-2">
									{/* Active model */}
									{tts.model_loaded && activeTTSModel && (
										<div className="flex flex-col gap-1">
											<span className="text-[11px] text-muted-foreground font-medium">Active model</span>
											<div className="flex items-center justify-between rounded px-2 py-1.5 text-[11px] bg-primary/10 border border-primary/30">
												<div className="flex items-center gap-1.5">
													<span className={cn("size-1.5 rounded-full bg-primary")} />
													<span className="font-medium">{activeTTSModel}</span>
													<Badge
														variant="outline"
														className={cn(
															"text-[8px] px-1 py-0",
															activeTTSDevice === "cuda"
																? "text-purple-400 border-purple-500/30"
																: "text-green-400 border-green-500/30",
														)}
													>
														{activeTTSDevice === "cuda" ? "GPU" : "CPU"}
													</Badge>
												</div>
												<div className="flex items-center gap-1.5">
													<Badge variant="default" className="text-[8px] px-1.5 py-0 h-4">Active</Badge>
													<Button
														variant="ghost"
														size="sm"
														className="h-5 text-[10px] px-1.5 text-muted-foreground"
														disabled={isTestingService === "tts"}
														onClick={() => handleTestService("tts", "TTS")}
													>
														{isTestingService === "tts" ? <Spinner className="size-2.5" /> : "Test"}
													</Button>
												</div>
											</div>
										</div>
									)}

									{/* Model list */}
									<div className="flex flex-col gap-1">
										<span className="text-[11px] text-muted-foreground font-medium">
											{tts.model_loaded ? "Switch to a different model" : "Choose a model to load"}
										</span>
										{SUGGESTED_TTS_MODELS.map((model) => {
											const isActive = model.name === activeTTSModel;
											const isSwitching = isSwitchingTTS === model.name;

											return (
												<div
													key={model.name}
													className={cn(
														"flex items-center gap-2 rounded px-2.5 py-2 text-[11px]",
														isActive
															? "bg-primary/10 border border-primary/30"
															: "bg-muted/30",
													)}
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span className="font-medium font-mono">{model.name}</span>
															<span className="text-muted-foreground">{model.size}</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-[8px] px-1 py-0",
																	model.device === "cpu"
																		? "text-green-400 border-green-500/30"
																		: "text-purple-400 border-purple-500/30",
																)}
															>
																{model.device === "cpu" ? "CPU" : "GPU"}
															</Badge>
															{model.multilingual && (
																<Badge
																	variant="outline"
																	className="text-[8px] px-1 py-0 text-blue-400 border-blue-500/30"
																>
																	Multilingual
																</Badge>
															)}
															{model.voiceCloning && (
																<Badge
																	variant="outline"
																	className="text-[8px] px-1 py-0 text-purple-400 border-purple-500/30"
																>
																	Cloning
																</Badge>
															)}
															{isActive && (
																<Badge variant="default" className="text-[8px] px-1 py-0 h-3.5">
																	Active
																</Badge>
															)}
														</div>
														<p className="text-muted-foreground mt-0.5">{model.description}</p>
													</div>
													<div className="shrink-0">
														{isSwitching ? (
															<Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled>
																<Spinner className="size-3 mr-1" />
																Loading...
															</Button>
														) : isActive ? (
															<Badge variant="default" className="text-[9px] px-1.5 py-0.5">
																In use
															</Badge>
														) : (
															<Button
																size="sm"
																variant="secondary"
																className="h-6 text-[10px] px-2"
																disabled={isSwitchingTTS !== null}
																onClick={() => handleSwitchTTSModel(model.name)}
															>
																<HugeiconsIcon icon={Download04Icon} className="size-3 mr-0.5" />
																Load & Use
															</Button>
														)}
													</div>
												</div>
											);
										})}
									</div>

									{ttsError && (
										<p className="text-[11px] text-destructive">{ttsError}</p>
									)}
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
										? `"${activeWhisperModel || whisper.model_size || "base"}" loaded`
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

							{isWhisperRunning && (
								<div className="mt-2 flex flex-col gap-2">
									{/* Active model */}
									{whisper.model_loaded && activeWhisperModel && (
										<div className="flex flex-col gap-1">
											<span className="text-[11px] text-muted-foreground font-medium">Active model</span>
											<div className="flex items-center justify-between rounded px-2 py-1.5 text-[11px] bg-primary/10 border border-primary/30">
												<div className="flex items-center gap-1.5">
													<span className={cn("size-1.5 rounded-full bg-primary")} />
													<span className="font-medium">{activeWhisperModel}</span>
													<Badge
														variant="outline"
														className={cn(
															"text-[8px] px-1 py-0",
															activeWhisperDevice === "cuda"
																? "text-purple-400 border-purple-500/30"
																: "text-green-400 border-green-500/30",
														)}
													>
														{activeWhisperDevice === "cuda" ? "GPU" : "CPU"}
													</Badge>
												</div>
												<div className="flex items-center gap-1.5">
													<Badge variant="default" className="text-[8px] px-1.5 py-0 h-4">Active</Badge>
													<Button
														variant="ghost"
														size="sm"
														className="h-5 text-[10px] px-1.5 text-muted-foreground"
														disabled={isTestingService === "whisper"}
														onClick={() => handleTestService("whisper", "Whisper")}
													>
														{isTestingService === "whisper" ? <Spinner className="size-2.5" /> : "Test"}
													</Button>
												</div>
											</div>
										</div>
									)}

									{/* Model list */}
									<div className="flex flex-col gap-1">
										<span className="text-[11px] text-muted-foreground font-medium">
											{whisper.model_loaded ? "Switch to a different model" : "Choose a model to load"}
										</span>
										{SUGGESTED_WHISPER_MODELS.map((model) => {
											const isActive = model.name === activeWhisperModel;
											const isSwitching = isSwitchingWhisper === model.name;

											return (
												<div
													key={model.name}
													className={cn(
														"flex items-center gap-2 rounded px-2.5 py-2 text-[11px]",
														isActive
															? "bg-primary/10 border border-primary/30"
															: "bg-muted/30",
													)}
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span className="font-medium font-mono">{model.name}</span>
															<span className="text-muted-foreground">{model.size}</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-[8px] px-1 py-0",
																	model.device === "cpu"
																		? "text-green-400 border-green-500/30"
																		: "text-purple-400 border-purple-500/30",
																)}
															>
																{model.device === "cpu" ? "CPU" : "GPU"}
															</Badge>
															{isActive && (
																<Badge variant="default" className="text-[8px] px-1 py-0 h-3.5">
																	Active
																</Badge>
															)}
														</div>
														<p className="text-muted-foreground mt-0.5">{model.description}</p>
													</div>
													<div className="shrink-0">
														{isSwitching ? (
															<Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled>
																<Spinner className="size-3 mr-1" />
																Loading...
															</Button>
														) : isActive ? (
															<Badge variant="default" className="text-[9px] px-1.5 py-0.5">
																In use
															</Badge>
														) : (
															<Button
																size="sm"
																variant="secondary"
																className="h-6 text-[10px] px-2"
																disabled={isSwitchingWhisper !== null}
																onClick={() => handleSwitchWhisperModel(model.name)}
															>
																<HugeiconsIcon icon={Download04Icon} className="size-3 mr-0.5" />
																Load & Use
															</Button>
														)}
													</div>
												</div>
											);
										})}
									</div>

									{whisperError && (
										<p className="text-[11px] text-destructive">{whisperError}</p>
									)}
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
										? `${activeImageModel || diffusion.model_name || "stable-diffusion-2-1"} loaded`
										: diffusion.model_installed === false
											? "Not installed"
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

							{isImageRunning && (
								<div className="mt-2 flex flex-col gap-2">
									{/* Active model */}
									{diffusion.model_loaded && activeImageModel && (
										<div className="flex flex-col gap-1">
											<span className="text-[11px] text-muted-foreground font-medium">Active model</span>
											<div className="flex items-center justify-between rounded px-2 py-1.5 text-[11px] bg-primary/10 border border-primary/30">
												<div className="flex items-center gap-1.5">
													<span className={cn("size-1.5 rounded-full bg-primary")} />
													<span className="font-medium">{activeImageModel}</span>
													<Badge
														variant="outline"
														className={cn(
															"text-[8px] px-1 py-0",
															activeImageDevice === "cuda"
																? "text-purple-400 border-purple-500/30"
																: "text-green-400 border-green-500/30",
														)}
													>
														{activeImageDevice === "cuda" ? "GPU" : "CPU"}
													</Badge>
												</div>
												<div className="flex items-center gap-1.5">
													<Badge variant="default" className="text-[8px] px-1.5 py-0 h-4">Active</Badge>
													<Button
														variant="ghost"
														size="sm"
														className="h-5 text-[10px] px-1.5 text-muted-foreground"
														disabled={isTestingService === "image"}
														onClick={() => handleTestService("image", "Image")}
													>
														{isTestingService === "image" ? <Spinner className="size-2.5" /> : "Test"}
													</Button>
												</div>
											</div>
										</div>
									)}

									{/* Model list */}
									<div className="flex flex-col gap-1">
										<span className="text-[11px] text-muted-foreground font-medium">
											{diffusion.model_loaded ? "Switch to a different model" : "Choose a model to load"}
										</span>
										{SUGGESTED_IMAGE_MODELS.map((model) => {
											const isActive = model.name === activeImageModel;
											const isSwitching = isSwitchingImage === model.name;

											return (
												<div
													key={model.name}
													className={cn(
														"flex items-center gap-2 rounded px-2.5 py-2 text-[11px]",
														isActive
															? "bg-primary/10 border border-primary/30"
															: "bg-muted/30",
													)}
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span className="font-medium font-mono">{model.name}</span>
															<span className="text-muted-foreground">{model.size}</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-[8px] px-1 py-0",
																	model.device === "cpu"
																		? "text-green-400 border-green-500/30"
																		: "text-purple-400 border-purple-500/30",
																)}
															>
																{model.device === "cpu" ? "CPU" : "GPU"}
															</Badge>
															{isActive && (
																<Badge variant="default" className="text-[8px] px-1 py-0 h-3.5">
																	Active
																</Badge>
															)}
														</div>
														<p className="text-muted-foreground mt-0.5">{model.description}</p>
													</div>
													<div className="shrink-0">
														{isSwitching ? (
															<Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled>
																<Spinner className="size-3 mr-1" />
																Loading...
															</Button>
														) : isActive ? (
															<Badge variant="default" className="text-[9px] px-1.5 py-0.5">
																In use
															</Badge>
														) : (
															<Button
																size="sm"
																variant="secondary"
																className="h-6 text-[10px] px-2"
																disabled={isSwitchingImage !== null}
																onClick={() => handleSwitchImageModel(model.name)}
															>
																<HugeiconsIcon icon={Download04Icon} className="size-3 mr-0.5" />
																Load & Use
															</Button>
														)}
													</div>
												</div>
											);
										})}
									</div>

									{diffusionError && (
										<p className="text-[11px] text-destructive">{diffusionError}</p>
									)}
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
