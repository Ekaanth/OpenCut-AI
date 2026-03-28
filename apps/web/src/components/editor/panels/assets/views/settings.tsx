"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FPS_PRESETS } from "@/constants/project-constants";
import { useEditor } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { dimensionToAspectRatio } from "@/utils/geometry";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/editor/panels/properties/section";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { aiClient } from "@/lib/ai-client";
import type { TurboQuantStatus } from "@/types/ai";
import { toast } from "sonner";

const ORIGINAL_PRESET_VALUE = "original";

export function findPresetIndexByAspectRatio({
	presets,
	targetAspectRatio,
}: {
	presets: Array<{ width: number; height: number }>;
	targetAspectRatio: string;
}) {
	for (let index = 0; index < presets.length; index++) {
		const preset = presets[index];
		const presetAspectRatio = dimensionToAspectRatio({
			width: preset.width,
			height: preset.height,
		});
		if (presetAspectRatio === targetAspectRatio) {
			return index;
		}
	}
	return -1;
}

export function SettingsView() {
	return (
		<PanelView contentClassName="px-0" hideHeader>
			<div className="flex flex-col">
				<Section showTopBorder={false}>
					<SectionContent>
						<ProjectInfoContent />
					</SectionContent>
				</Section>
				<Section>
					<SectionHeader>
						<SectionTitle>AI Optimization</SectionTitle>
					</SectionHeader>
					<SectionContent>
						<AIOptimizationSection />
					</SectionContent>
				</Section>
				<Section>
					<SectionHeader>
						<SectionTitle>API Keys</SectionTitle>
					</SectionHeader>
					<SectionContent>
						<APIKeysSection />
					</SectionContent>
				</Section>
			</div>
		</PanelView>
	);
}

function ProjectInfoContent() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { canvasPresets } = useEditorStore();

	const currentCanvasSize = activeProject.settings.canvasSize;
	const currentAspectRatio = dimensionToAspectRatio(currentCanvasSize);
	const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;
	const presetIndex = findPresetIndexByAspectRatio({
		presets: canvasPresets,
		targetAspectRatio: currentAspectRatio,
	});
	const selectedPresetValue =
		presetIndex !== -1 ? presetIndex.toString() : ORIGINAL_PRESET_VALUE;

	const handleAspectRatioChange = ({ value }: { value: string }) => {
		if (value === ORIGINAL_PRESET_VALUE) {
			const canvasSize = originalCanvasSize ?? currentCanvasSize;
			editor.project.updateSettings({
				settings: { canvasSize },
			});
			return;
		}
		const index = parseInt(value, 10);
		const preset = canvasPresets[index];
		if (preset) {
			editor.project.updateSettings({ settings: { canvasSize: preset } });
		}
	};

	const handleFpsChange = ({ value }: { value: string }) => {
		const fps = parseFloat(value);
		editor.project.updateSettings({ settings: { fps } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Name</Label>
				<span className="text-sm leading-none">
					{activeProject.metadata.name}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Aspect ratio</Label>
				<Select
					value={selectedPresetValue}
					onValueChange={(value) => handleAspectRatioChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select an aspect ratio" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ORIGINAL_PRESET_VALUE}>Original</SelectItem>
						{canvasPresets.map((preset, index) => {
							const label = dimensionToAspectRatio({
								width: preset.width,
								height: preset.height,
							});
							return (
								<SelectItem key={label} value={index.toString()}>
									{label}
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Frame rate</Label>
				<Select
					value={activeProject.settings.fps.toString()}
					onValueChange={(value) => handleFpsChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select a frame rate" />
					</SelectTrigger>
					<SelectContent>
						{FPS_PRESETS.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								{preset.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

// ----- AI Optimization Section -----

import {
	KV_CACHE_CONFIGS,
	MODEL_TIERS,
	MEMORY_BUDGETS,
} from "@/constants/turboquant-constants";

const CONFIG_STORAGE_KEY = "opencut-ai-config";

function loadSavedConfig(): Record<string, string | number> {
	try {
		const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch { return {}; }
}

function saveConfig(updates: Record<string, string | number>) {
	try {
		const existing = loadSavedConfig();
		localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ ...existing, ...updates }));
	} catch { /* ignore */ }
}

/** Merge user's saved preferences over backend status so selections persist across navigation. */
function mergeWithSavedConfig(data: TurboQuantStatus): TurboQuantStatus {
	const saved = loadSavedConfig();
	if (Object.keys(saved).length === 0) return data;
	const merged = { ...data };
	if ("AI_MODEL_TIER" in saved) merged.model_tier = String(saved.AI_MODEL_TIER);
	if ("KV_CACHE_BITS" in saved) merged.kv_cache_bits = Number(saved.KV_CACHE_BITS);
	if ("AI_MEMORY_BUDGET" in saved) merged.memory_budget = String(saved.AI_MEMORY_BUDGET);
	return merged;
}

function AIOptimizationSection() {
	const [status, setStatus] = useState<TurboQuantStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchStatus = useCallback(() => {
		setLoading(true);
		aiClient
			.turboquantStatus()
			.then((data) => { setStatus(mergeWithSavedConfig(data)); setError(null); })
			.catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => { fetchStatus(); }, [fetchStatus]);

	// On mount, push any saved config to the backend
	useEffect(() => {
		const saved = loadSavedConfig();
		if (Object.keys(saved).length === 0) return;
		aiClient.updateConfig(saved)
			.then(() => fetchStatus())
			.catch(() => { /* backend not ready yet, config stays in localStorage */ });
	}, [fetchStatus]);

	const handleConfigUpdate = useCallback((updates: Record<string, string | number>, label: string) => {
		// 1. Save to localStorage (persists across navigation)
		saveConfig(updates);

		// 2. Update UI immediately
		setStatus((prev) => {
			if (!prev) return prev;
			const next = { ...prev };
			if ("AI_MODEL_TIER" in updates) next.model_tier = String(updates.AI_MODEL_TIER);
			if ("KV_CACHE_BITS" in updates) next.kv_cache_bits = Number(updates.KV_CACHE_BITS);
			if ("AI_MEMORY_BUDGET" in updates) next.memory_budget = String(updates.AI_MEMORY_BUDGET);
			return next;
		});
		toast.success(`${label} applied`);

		// 3. Push to backend in background
		aiClient.updateConfig(updates)
			.then(() => fetchStatus())
			.catch(() => { /* stays in localStorage for next sync */ });
	}, [fetchStatus]);

	if (loading) {
		return <p className="text-[10px] text-muted-foreground">Loading optimization status...</p>;
	}

	if (error) {
		return (
			<p className="text-[10px] text-muted-foreground">
				AI backend not reachable. Start the backend to configure optimization.
			</p>
		);
	}

	if (!status) return null;

	const hw = status.hardware;
	const stack = status.stack_memory_estimate;
	const savingsPercent = stack.total_without_turboquant_mb > 0
		? Math.round((stack.savings_mb / stack.total_without_turboquant_mb) * 100)
		: 0;

	// Compute recommendations based on system RAM
	const ramGb = Math.round(hw.ram_total_mb / 1024);
	const activeTier = status.model_tier === "auto" ? status.recommended_tier : status.model_tier;
	const recommendedTier = status.recommended_tier;
	const recommendedKvBits = ramGb <= 8 ? 3 : 4;
	const recommendedBudget = ramGb >= 32 ? "32GB" : ramGb >= 16 ? "16GB" : ramGb >= 8 ? "8GB" : "4GB";
	// Resolve "auto" budget to the actual best match
	const activeBudget = status.memory_budget === "auto" ? recommendedBudget : status.memory_budget;

	return (
		<div className="flex flex-col gap-3">
			{/* Current status row */}
			<div className="flex items-center justify-between rounded-md border px-2.5 py-1.5 bg-muted/20">
				<div className="flex items-center gap-1.5">
					<span
						className={cn(
							"size-1.5 rounded-full shrink-0",
							status.inference_service.available ? "bg-green-500" : "bg-muted-foreground/30",
						)}
					/>
					<span className="text-[10px] font-medium">
						{status.recommended_model.name}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Badge variant="secondary" className="text-[8px] px-1 py-0">
						{Math.round(hw.ram_available_mb / 1024)} / {Math.round(hw.ram_total_mb / 1024)} GB
					</Badge>
					{hw.gpu_available && (
						<Badge variant="secondary" className="text-[8px] px-1 py-0">
							{hw.gpu_name || "GPU"}
						</Badge>
					)}
				</div>
			</div>

			{/* Memory savings */}
			{savingsPercent > 0 && (
				<div className="flex items-center justify-between rounded-md border border-green-500/20 bg-green-500/5 px-2.5 py-1.5">
					<span className="text-[10px]">
						<span className="font-mono font-medium">{(stack.total_with_turboquant_mb / 1024).toFixed(1)} GB</span>
						<span className="text-muted-foreground line-through ml-1.5 font-mono text-[9px]">
							{(stack.total_without_turboquant_mb / 1024).toFixed(1)} GB
						</span>
					</span>
					<Badge variant="outline" className="text-[8px] px-1.5 py-0 text-green-500 border-green-500/30">
						{savingsPercent}% saved
					</Badge>
				</div>
			)}

			{/* Performance tier selector */}
			<div className="flex flex-col gap-1.5">
				<Label className="text-xs">Performance Tier</Label>
				<div className="flex flex-col gap-1">
					{MODEL_TIERS.map((tier) => {
						const isActive = activeTier === tier.name;
						const isRecommended = recommendedTier === tier.name;
						return (
							<button
								key={tier.name}
								type="button"

								onClick={() => {
									if (isActive) return;
									handleConfigUpdate({ AI_MODEL_TIER: tier.name }, `${tier.label} tier`);
								}}
								className={cn(
									"flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors",
									isActive
										? "border-primary/40 bg-primary/5"
										: isRecommended
											? "border-amber-500/30 hover:bg-amber-500/5 cursor-pointer"
											: "border-border hover:bg-accent cursor-pointer",
								)}
							>
								<div className="flex items-center gap-1.5">
									{isActive ? (
										<svg className="size-3 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
											<path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									) : (
										<span className="size-3 shrink-0" />
									)}
									<span className="text-[10px] font-medium">{tier.label}</span>
									<span className="text-[9px] text-muted-foreground">{tier.ramRange}</span>
									{isRecommended && (
										<Badge variant="outline" className={cn(
											"text-[7px] px-1 py-0",
											isActive ? "text-primary border-primary/40" : "text-amber-500 border-amber-500/40",
										)}>
											Best for {ramGb} GB
										</Badge>
									)}
								</div>
								<Badge
									variant={isActive ? "default" : "secondary"}
									className="text-[8px] px-1 py-0"
								>
									{tier.quality}
								</Badge>
							</button>
						);
					})}
				</div>
			</div>

			{/* KV Cache compression selector */}
			<div className="flex flex-col gap-1.5">
				<Label className="text-xs">KV Cache Compression</Label>
				<p className="text-[9px] text-muted-foreground">
					Lower bits = more memory saved, slightly less accuracy.
				</p>
				<div className="flex flex-col gap-1">
					{KV_CACHE_CONFIGS.map((config) => {
						const isActive = status.kv_cache_bits === config.bits;
						const isRecommended = recommendedKvBits === config.bits;
						return (
							<button
								key={config.bits}
								type="button"

								onClick={() => {
									if (isActive) return;
									handleConfigUpdate({ KV_CACHE_BITS: config.bits }, `${config.bits}-bit compression`);
								}}
								className={cn(
									"flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors",
									isActive
										? "border-primary/40 bg-primary/5"
										: isRecommended
											? "border-amber-500/30 hover:bg-amber-500/5 cursor-pointer"
											: "border-border hover:bg-accent cursor-pointer",
								)}
							>
								<div className="flex items-center gap-1.5">
									{isActive ? (
										<svg className="size-3 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
											<path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									) : (
										<span className="size-3 shrink-0" />
									)}
									<span className="text-[10px] font-medium">{config.bits}-bit</span>
									<span className="text-[9px] text-muted-foreground">
										{config.compressionRatio}x compression
									</span>
									{isRecommended && (
										<Badge variant="outline" className={cn(
											"text-[7px] px-1 py-0",
											isActive ? "text-primary border-primary/40" : "text-amber-500 border-amber-500/40",
										)}>
											Recommended
										</Badge>
									)}
								</div>
								<Badge
									variant="secondary"
									className={cn(
										"text-[8px] px-1 py-0",
										config.quality === "Near-lossless" && "text-green-500",
										config.quality === "Minor degradation" && "text-yellow-500",
										config.quality === "Noticeable loss" && "text-red-500",
									)}
								>
									{config.quality}
								</Badge>
							</button>
						);
					})}
				</div>
			</div>

			{/* Memory budget selector */}
			<div className="flex flex-col gap-1.5">
				<Label className="text-xs">Memory Budget</Label>
				<div className="flex flex-col gap-1">
					{MEMORY_BUDGETS.filter((b) => b.value !== "auto").map((b) => {
						const isActive = activeBudget === b.value;
						const isRecommended = b.value === recommendedBudget;
						return (
							<button
								key={b.value}
								type="button"

								onClick={() => {
									if (isActive) return;
									handleConfigUpdate({ AI_MEMORY_BUDGET: b.value }, `${b.label} budget`);
								}}
								className={cn(
									"flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors",
									isActive
										? "border-primary/40 bg-primary/5"
										: isRecommended
											? "border-amber-500/30 hover:bg-amber-500/5 cursor-pointer"
											: "border-border hover:bg-accent cursor-pointer",
								)}
							>
								<div className="flex items-center gap-1.5">
									{isActive ? (
										<svg className="size-3 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
											<path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									) : (
										<span className="size-3 shrink-0" />
									)}
									<span className="text-[10px] font-medium">{b.label}</span>
									{isRecommended && (
										<Badge variant="outline" className={cn(
											"text-[7px] px-1 py-0",
											isActive ? "text-primary border-primary/40" : "text-amber-500 border-amber-500/40",
										)}>
											Best match
										</Badge>
									)}
								</div>
								<span className="text-[9px] text-muted-foreground">{b.description}</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ----- API Keys Section -----

const API_KEY_FIELDS = [
	{
		key: "FREESOUND_CLIENT_ID",
		label: "Freesound Client ID",
		placeholder: "Your client ID",
		description: "Sound library search",
		envVar: "FREESOUND_CLIENT_ID",
		envValue: process.env.FREESOUND_CLIENT_ID || "",
		info: "Enables searching and browsing thousands of free sounds from the Freesound library. Get your key at freesound.org/apiv2/apply",
		required: true,
	},
	{
		key: "FREESOUND_API_KEY",
		label: "Freesound API Key",
		placeholder: "Your API key",
		description: "Sound preview and download",
		envVar: "FREESOUND_API_KEY",
		envValue: process.env.FREESOUND_API_KEY || "",
		info: "Required to preview and download sounds from Freesound. Without this key, the Sounds panel won't return results.",
		required: true,
	},
	{
		key: "sarvam",
		label: "Sarvam AI API Key",
		placeholder: "sk_...",
		description: "Indian language transcription, translation & TTS",
		envVar: "OPENCUTAI_SARVAM_API_KEY",
		envValue: process.env.NEXT_PUBLIC_SARVAM_API_KEY || process.env.OPENCUTAI_SARVAM_API_KEY || "",
		info: "Enables transcription, translation, and text-to-speech for 22 Indian regional languages (Hindi, Bengali, Tamil, Telugu, etc.) via Sarvam AI. Get your key at dashboard.sarvam.ai — free credits on signup.",
		required: false,
	},
	{
		key: "smallest",
		label: "Smallest AI API Key",
		placeholder: "Your Smallest AI key",
		description: "Lightning TTS (15 languages, 80+ voices) & Pulse STT (39 languages)",
		envVar: "OPENCUTAI_SMALLEST_API_KEY",
		envValue: process.env.NEXT_PUBLIC_SMALLEST_API_KEY || process.env.OPENCUTAI_SMALLEST_API_KEY || "",
		info: "Enables ultra-low-latency text-to-speech with 80+ natural voices across 15 languages, and speech-to-text supporting 39 languages with speaker diarization and emotion detection. Get your key at app.smallest.ai.",
		required: false,
	},
];

function APIKeysSection() {
	const [keys, setKeys] = useState<Record<string, string>>(() => {
		if (typeof window === "undefined") return {};
		try {
			const stored = localStorage.getItem("opencut-api-keys");
			return stored ? JSON.parse(stored) : {};
		} catch {
			return {};
		}
	});
	const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

	const toggleVisibility = useCallback((key: string) => {
		setVisibleKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	const handleSave = useCallback((key: string, value: string) => {
		setKeys((prev) => {
			const next = { ...prev, [key]: value };
			try {
				localStorage.setItem("opencut-api-keys", JSON.stringify(next));
			} catch {}
			return next;
		});
	}, []);

	const handleClear = useCallback((key: string) => {
		setKeys((prev) => {
			const next = { ...prev };
			delete next[key];
			try {
				localStorage.setItem("opencut-api-keys", JSON.stringify(next));
			} catch {}
			return next;
		});
	}, []);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-[11px] text-muted-foreground leading-relaxed">
				Configure API keys for services. Keys are stored locally in your browser. You can also set them in <code className="text-[10px] font-mono bg-muted px-1 rounded">.env.local</code>.
			</p>

			{API_KEY_FIELDS.map((field) => {
				const localValue = keys[field.key]?.trim() || "";
				const envValue = field.envValue?.trim() || "";
				const effectiveValue = localValue || envValue;
				const hasValue = !!effectiveValue;
				const isFromEnv = !localValue && !!envValue;
				const isVisible = visibleKeys.has(field.key);

				return (
					<div
						key={field.key}
						className={cn(
							"flex flex-col gap-1.5 rounded-lg border p-2.5",
							hasValue ? "border-green-500/20 bg-green-500/5" : field.required ? "border-yellow-500/20 bg-yellow-500/5" : "border-border",
						)}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span
									className={cn(
										"size-1.5 rounded-full shrink-0",
										hasValue ? "bg-green-500" : field.required ? "bg-yellow-500" : "bg-muted-foreground/30",
									)}
								/>
								<Label className="text-[11px]">{field.label}</Label>
								{field.required && !hasValue && (
									<Badge variant="outline" className="text-[8px] px-1 py-0 text-yellow-500 border-yellow-500/30">
										Required
									</Badge>
								)}
								{isFromEnv && (
									<Badge variant="secondary" className="text-[8px] px-1 py-0">
										From env
									</Badge>
								)}
							</div>
							<div className="flex items-center gap-1">
								{/* Info popover */}
								<Popover>
									<PopoverTrigger asChild>
										<button
											type="button"
											className="size-4 rounded-full border text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
										>
											i
										</button>
									</PopoverTrigger>
									<PopoverContent side="left" align="start" className="w-64 p-3">
										<p className="text-xs leading-relaxed">{field.info}</p>
										<p className="text-[10px] text-muted-foreground mt-2 font-mono">
											env: {field.envVar}
										</p>
									</PopoverContent>
								</Popover>
								{hasValue && (
									<>
										<button
											type="button"
											className="text-[9px] text-muted-foreground hover:text-foreground px-1"
											onClick={() => toggleVisibility(field.key)}
										>
											{isVisible ? "Hide" : "Show"}
										</button>
										{!isFromEnv && (
											<button
												type="button"
												className="text-[9px] text-destructive hover:text-destructive/80 px-1"
												onClick={() => handleClear(field.key)}
											>
												Clear
											</button>
										)}
									</>
								)}
							</div>
						</div>

						{hasValue && !isVisible ? (
							<div
								className="w-full rounded-md border bg-muted/30 px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground cursor-default select-none"
								onClick={() => toggleVisibility(field.key)}
							>
								{"•".repeat(Math.min(effectiveValue.length, 24))}
							</div>
						) : (
							<input
								type={isVisible ? "text" : "password"}
								placeholder={field.placeholder}
								value={isFromEnv ? envValue : (localValue || "")}
								onChange={(e) => handleSave(field.key, e.target.value)}
								disabled={isFromEnv}
								className={cn(
									"w-full rounded-md border bg-transparent px-2.5 py-1.5 text-[11px] outline-none",
									"focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40",
									"font-mono",
									isFromEnv && "opacity-60 cursor-not-allowed",
								)}
							/>
						)}

						<p className="text-[10px] text-muted-foreground">{field.description}</p>
					</div>
				);
			})}
		</div>
	);
}
