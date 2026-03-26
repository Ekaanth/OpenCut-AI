"use client";

import { useCallback, useState } from "react";
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
				<Popover>
					<Section className="cursor-pointer">
						<PopoverTrigger asChild>
							<div>
								<SectionHeader
									trailing={<div className="size-4 rounded-sm bg-red-500" />}
								>
									<SectionTitle>Background</SectionTitle>
								</SectionHeader>
							</div>
						</PopoverTrigger>
					</Section>
					<PopoverContent>
						<div className="size-4 rounded-sm bg-red-500" />
					</PopoverContent>
				</Popover>
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
		key: "NEXT_PUBLIC_AI_BACKEND_URL",
		label: "AI Backend URL",
		placeholder: "http://localhost:8420",
		description: "AI service endpoint",
		envVar: "NEXT_PUBLIC_AI_BACKEND_URL",
		envValue: process.env.NEXT_PUBLIC_AI_BACKEND_URL || "",
		info: "The URL where the AI backend is running. Change this if you're running the backend on a different port or remote server. Default: http://localhost:8420",
		required: false,
	},
	{
		key: "openai",
		label: "OpenAI API Key",
		placeholder: "sk-...",
		description: "Cloud AI models",
		envVar: "OPENAI_API_KEY",
		envValue: "",
		info: "Unlocks access to GPT-4 and other OpenAI models for higher quality AI commands, script editing, and content generation. Without this, the editor uses local Ollama models.",
		required: false,
	},
	{
		key: "elevenlabs",
		label: "ElevenLabs API Key",
		placeholder: "xi-...",
		description: "Premium voice generation",
		envVar: "ELEVENLABS_API_KEY",
		envValue: "",
		info: "Enables high-quality, natural-sounding voice generation with 100+ voices and voice cloning. Without this, the editor uses the local Coqui TTS service.",
		required: false,
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
