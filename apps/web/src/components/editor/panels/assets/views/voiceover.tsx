"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelView } from "./base-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { aiClient } from "@/lib/ai-client";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

// Open-source TTS models
const TTS_MODELS = [
	{
		id: "xtts_v2",
		name: "Coqui XTTS v2",
		description: "Multilingual with voice cloning. Currently installed on backend.",
		size: "~1.8 GB",
		supportsCloning: true,
		quality: "High",
		speed: "Slow",
		installed: true,
	},
	{
		id: "styletts2",
		name: "StyleTTS 2",
		description: "Human-level quality with style transfer. Extremely natural prosody.",
		size: "~500 MB",
		supportsCloning: true,
		quality: "Very High",
		speed: "Medium",
		installed: false,
	},
	{
		id: "bark",
		name: "Bark (Suno)",
		description: "Expressive speech with emotions, laughter, and music.",
		size: "~5 GB",
		supportsCloning: false,
		quality: "Very High",
		speed: "Very Slow",
		installed: false,
	},
	{
		id: "piper",
		name: "Piper",
		description: "Fast and lightweight. Great for long narration.",
		size: "~50 MB/voice",
		supportsCloning: false,
		quality: "Good",
		speed: "Very Fast",
		installed: false,
	},
	{
		id: "fish-speech",
		name: "Fish Speech",
		description: "Multilingual zero-shot voice cloning.",
		size: "~1 GB",
		supportsCloning: true,
		quality: "High",
		speed: "Fast",
		installed: false,
	},
	{
		id: "kokoro",
		name: "Kokoro TTS",
		description: "Small, fast, surprisingly natural.",
		size: "~80 MB",
		supportsCloning: false,
		quality: "High",
		speed: "Very Fast",
		installed: false,
	},
];

const SUPPORTED_LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "it", name: "Italian" },
	{ code: "pt", name: "Portuguese" },
	{ code: "ja", name: "Japanese" },
	{ code: "zh-cn", name: "Chinese" },
	{ code: "ko", name: "Korean" },
	{ code: "ru", name: "Russian" },
	{ code: "ar", name: "Arabic" },
	{ code: "tr", name: "Turkish" },
];

type GenerationMode = "full" | "per-segment";

export function VoiceoverView() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const hasTranscript = segments.length > 0;

	const [language, setLanguage] = useState("en");
	const [selectedModel, setSelectedModel] = useState("xtts_v2");
	const [mode, setMode] = useState<GenerationMode>("full");
	const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
	const [customText, setCustomText] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationProgress, setGenerationProgress] = useState("");
	const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
	const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
	const [clonedVoicePath, setClonedVoicePath] = useState<string | null>(null);
	const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [useTranscript, setUseTranscript] = useState(true);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	const currentModel = TTS_MODELS.find((m) => m.id === selectedModel) ?? TTS_MODELS[0];

	// Auto-select cloning model when voice is uploaded, non-cloning otherwise
	useEffect(() => {
		if (clonedVoicePath) {
			// Pick first installed cloning model
			const cloningModel = TTS_MODELS.find((m) => m.supportsCloning && m.installed);
			if (cloningModel) setSelectedModel(cloningModel.id);
		}
	}, [clonedVoicePath]);

	// Text to generate from
	const textToGenerate = useMemo(() => {
		if (useTranscript && hasTranscript) {
			return segments.map((s) => s.text).join(" ").trim();
		}
		return customText.trim();
	}, [useTranscript, hasTranscript, segments, customText]);

	// Check if translation is needed
	const transcriptLanguage = useTranscriptStore((s) => s.language) || "en";
	const needsTranslation = useTranscript && hasTranscript && language !== transcriptLanguage && language !== "en";

	const addTask = useBackgroundTasksStore((s) => s.addTask);
	const updateTask = useBackgroundTasksStore((s) => s.updateTask);

	// Translate text for TTS (keeps transcript UI unchanged)
	const translateForTTS = useCallback(async (text: string, taskId?: string): Promise<string> => {
		if (!needsTranslation) return text;
		const langName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? language;
		const progress = `Translating to ${langName}...`;
		setGenerationProgress(progress);
		if (taskId) updateTask(taskId, { progress });
		return await aiClient.translateText(text, langName);
	}, [needsTranslation, language, updateTask]);

	// Generate full voiceover (as background task)
	const handleGenerate = useCallback(async () => {
		if (!textToGenerate) {
			toast.error("No text to generate speech from");
			return;
		}

		const taskId = `vo-full-${Date.now()}`;
		addTask({ id: taskId, type: "voiceover", label: "Generating voiceover", progress: "Preparing..." });

		setIsGenerating(true);
		setError(null);
		setGeneratedAudioUrl(null);
		setGeneratedBlob(null);
		setGenerationProgress("Preparing text...");

		try {
			const ttsText = await translateForTTS(textToGenerate, taskId);

			setGenerationProgress("Generating speech...");
			updateTask(taskId, { progress: "Generating speech..." });

			const blob = await aiClient.generateSpeechBlob({
				text: ttsText,
				language,
				speakerWav: clonedVoicePath ?? undefined,
				speaker: clonedVoicePath ? undefined : voiceGender,
			});

			const url = URL.createObjectURL(blob);
			setGeneratedAudioUrl(url);
			setGeneratedBlob(blob);
			setGenerationProgress("");
			updateTask(taskId, { status: "completed", completedAt: Date.now() });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Generation failed";
			setError(msg);
			setGenerationProgress("");
			updateTask(taskId, { status: "error", error: msg, completedAt: Date.now() });
		} finally {
			setIsGenerating(false);
		}
	}, [textToGenerate, language, clonedVoicePath, voiceGender, translateForTTS, addTask, updateTask]);

	// Generate per-segment and auto-add to timeline (as background task)
	const handleGeneratePerSegment = useCallback(async () => {
		if (!hasTranscript || segments.length === 0) {
			toast.error("No transcript segments to generate from");
			return;
		}

		const taskId = `vo-seg-${Date.now()}`;
		const langName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? language;
		addTask({
			id: taskId,
			type: "voiceover",
			label: `Voiceover (${segments.length} segments)`,
			progress: "Starting...",
		});

		setIsGenerating(true);
		setError(null);

		const trackId = editor.timeline.addTrack({ type: "audio", index: 0 });

		try {
			for (let i = 0; i < segments.length; i++) {
				const seg = segments[i];
				const originalText = seg.text.trim();
				if (!originalText) continue;

				let ttsText = originalText;
				if (needsTranslation) {
					const progress = `Translating ${i + 1}/${segments.length} to ${langName}...`;
					setGenerationProgress(progress);
					updateTask(taskId, { progress });
					ttsText = await aiClient.translateText(originalText, langName);
				}

				const progress = `Generating ${i + 1}/${segments.length}...`;
				setGenerationProgress(progress);
				updateTask(taskId, { progress });

				const blob = await aiClient.generateSpeechBlob({
					text: ttsText,
					language,
					speakerWav: clonedVoicePath ?? undefined,
					speaker: clonedVoicePath ? undefined : voiceGender,
				});

				const file = new File([blob], `voiceover_seg_${i}.wav`, { type: "audio/wav" });
				const audioUrl = URL.createObjectURL(file);
				const duration = await getAudioDuration(audioUrl);

				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId },
					element: {
						type: "audio",
						sourceType: "library",
						sourceUrl: audioUrl,
						name: `Voice [${language}]: ${originalText.slice(0, 25)}...`,
						startTime: seg.start,
						duration: duration || (seg.end - seg.start),
						trimStart: 0,
						trimEnd: 0,
						sourceDuration: duration || (seg.end - seg.start),
						volume: 1,
					},
				});
			}

			setGenerationProgress("");
			updateTask(taskId, { status: "completed", completedAt: Date.now() });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Generation failed";
			setError(msg);
			setGenerationProgress("");
			updateTask(taskId, { status: "error", error: msg, completedAt: Date.now() });
		} finally {
			setIsGenerating(false);
		}
	}, [segments, hasTranscript, language, clonedVoicePath, voiceGender, editor, needsTranslation, addTask, updateTask]);

	// Add full voiceover to timeline
	const handleAddToTimeline = useCallback(async () => {
		if (!generatedBlob) return;

		const file = new File([generatedBlob], `voiceover_${Date.now()}.wav`, { type: "audio/wav" });
		const audioUrl = URL.createObjectURL(file);
		const duration = await getAudioDuration(audioUrl);
		const currentTime = editor.playback.getCurrentTime();

		const trackId = editor.timeline.addTrack({ type: "audio", index: 0 });

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId },
			element: {
				type: "audio",
				sourceType: "library",
				sourceUrl: audioUrl,
				name: "Voiceover",
				startTime: currentTime,
				duration: duration || 5,
				trimStart: 0,
				trimEnd: 0,
				sourceDuration: duration || 5,
				volume: 1,
			},
		});

		toast.success("Voiceover added to timeline");
	}, [editor, generatedBlob]);

	// Upload voice sample for cloning
	const handleUploadVoice = useCallback(async (file: File) => {
		setIsUploading(true);
		setError(null);
		try {
			const result = await aiClient.cloneVoice(file, file.name.replace(/\.[^.]+$/, ""));
			setClonedVoicePath(result.path);
			setClonedVoiceName(result.name);
			toast.success(`Voice "${result.name}" ready for cloning`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Voice cloning failed");
		} finally {
			setIsUploading(false);
		}
	}, []);

	const installedModels = TTS_MODELS.filter((m) => m.installed);
	const showCloningSection = currentModel.supportsCloning;

	return (
		<PanelView title="Voiceover">
			<div className="flex flex-col gap-4">

				{/* Source text */}
				{hasTranscript && (
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Label className="text-xs flex-1">Source</Label>
							<button
								type="button"
								className={cn(
									"text-[10px] px-2 py-0.5 rounded-full border transition-colors",
									useTranscript ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent",
								)}
								onClick={() => setUseTranscript(true)}
							>
								Transcript
							</button>
							<button
								type="button"
								className={cn(
									"text-[10px] px-2 py-0.5 rounded-full border transition-colors",
									!useTranscript ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent",
								)}
								onClick={() => setUseTranscript(false)}
							>
								Custom text
							</button>
						</div>

						{useTranscript && (
							<div className="rounded-md bg-muted/50 px-2.5 py-2 max-h-24 overflow-y-auto">
								<p className="text-[10px] text-muted-foreground leading-relaxed">
									{segments.map((s) => s.text).join(" ").slice(0, 500)}
									{segments.map((s) => s.text).join(" ").length > 500 && "..."}
								</p>
							</div>
						)}
					</div>
				)}

				{(!hasTranscript || !useTranscript) && (
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Text</Label>
						<textarea
							value={customText}
							onChange={(e) => setCustomText(e.target.value)}
							placeholder="Type or paste text to convert to speech..."
							rows={4}
							maxLength={5000}
							className={cn(
								"w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-xs outline-none",
								"focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40",
							)}
						/>
					</div>
				)}

				{/* Voice output language */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Voice language</Label>
					<Select value={language} onValueChange={setLanguage}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SUPPORTED_LANGUAGES.map((lang) => (
								<SelectItem key={lang.code} value={lang.code}>
									{lang.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{needsTranslation && (
						<div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5">
							<p className="text-[10px] text-blue-400 leading-relaxed">
								The transcript ({SUPPORTED_LANGUAGES.find((l) => l.code === transcriptLanguage)?.name || transcriptLanguage}) will be auto-translated to {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || language} before generating speech. The transcript panel stays in the original language.
							</p>
						</div>
					)}
				</div>

				{/* Voice gender */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Voice type</Label>
					<div className="flex gap-1.5">
						<button
							type="button"
							className={cn(
								"flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
								voiceGender === "male"
									? "bg-primary text-primary-foreground border-primary"
									: "text-muted-foreground hover:bg-accent border-border",
							)}
							onClick={() => setVoiceGender("male")}
						>
							Male
						</button>
						<button
							type="button"
							className={cn(
								"flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
								voiceGender === "female"
									? "bg-primary text-primary-foreground border-primary"
									: "text-muted-foreground hover:bg-accent border-border",
							)}
							onClick={() => setVoiceGender("female")}
						>
							Female
						</button>
					</div>
					{clonedVoiceName && (
						<p className="text-[9px] text-muted-foreground">
							Voice type is overridden by the cloned voice below.
						</p>
					)}
				</div>

				{/* Voice cloning */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Voice clone (optional)</Label>
					{clonedVoiceName ? (
						<div className="flex items-center justify-between rounded-md bg-green-500/10 border border-green-500/20 px-2.5 py-2">
							<div className="flex items-center gap-2">
								<span className="size-1.5 rounded-full bg-green-500" />
								<span className="text-[11px] font-medium">Cloned: {clonedVoiceName}</span>
							</div>
							<button
								type="button"
								className="text-[10px] text-destructive hover:text-destructive/80"
								onClick={() => { setClonedVoicePath(null); setClonedVoiceName(null); }}
							>
								Remove
							</button>
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							<div className="flex gap-1.5">
								<Button
									variant="outline"
									size="sm"
									className="flex-1 text-[10px] h-7"
									disabled={isUploading}
									onClick={() => fileInputRef.current?.click()}
								>
									{isUploading ? <><Spinner className="size-3 mr-1" />Uploading...</> : "Upload voice sample"}
								</Button>
								<Badge variant="secondary" className="text-[9px] px-1.5 py-0 self-center">
									or use default
								</Badge>
							</div>
							<p className="text-[9px] text-muted-foreground">
								Upload 10-30s audio to clone a specific voice. Without a sample, the default model voice is used.
							</p>
							<input
								ref={fileInputRef}
								type="file"
								accept=".wav,.mp3,.flac,.ogg,.m4a"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) handleUploadVoice(file);
									e.target.value = "";
								}}
							/>
						</div>
					)}
				</div>

				{/* Model info */}
				<div className="flex flex-col gap-1.5">
					<Label className="text-xs">Model</Label>
					<Select value={selectedModel} onValueChange={setSelectedModel}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TTS_MODELS.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									<div className="flex items-center gap-2">
										<span>{model.name}</span>
										{model.installed && <Badge variant="secondary" className="text-[8px] px-1 py-0">Installed</Badge>}
										{!model.installed && <Badge variant="outline" className="text-[8px] px-1 py-0">Not installed</Badge>}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-1.5 flex-wrap">
						<Badge variant="secondary" className="text-[9px] px-1 py-0">{currentModel.quality}</Badge>
						<Badge variant="secondary" className="text-[9px] px-1 py-0">{currentModel.speed}</Badge>
						<Badge variant="secondary" className="text-[9px] px-1 py-0">{currentModel.size}</Badge>
						{currentModel.supportsCloning && (
							<Badge variant="outline" className="text-[9px] px-1 py-0 text-green-500 border-green-500/30">Cloning</Badge>
						)}
					</div>
				</div>

				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-2.5">
						<p className="text-destructive text-[11px]">{error}</p>
					</div>
				)}

				{generationProgress && (
					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<Spinner className="size-3" />
						{generationProgress}
					</div>
				)}

				{/* Generate buttons */}
				<div className="flex flex-col gap-1.5">
					{hasTranscript && useTranscript && (
						<Button
							className="w-full"
							onClick={handleGeneratePerSegment}
							disabled={isGenerating || !currentModel.installed}
						>
							{isGenerating && <Spinner className="mr-1" />}
							Generate voiceover per segment
						</Button>
					)}

					<Button
						variant={hasTranscript && useTranscript ? "outline" : "default"}
						className="w-full"
						onClick={handleGenerate}
						disabled={isGenerating || !textToGenerate || !currentModel.installed}
					>
						{isGenerating && !generationProgress.includes("segment") && <Spinner className="mr-1" />}
						Generate full voiceover
					</Button>

					{!currentModel.installed && (
						<p className="text-[10px] text-yellow-500 text-center">
							This model is not installed. Use Coqui XTTS v2 (installed) or install this model on the backend.
						</p>
					)}
				</div>

				{/* Audio preview */}
				{generatedAudioUrl && (
					<div className="flex flex-col gap-2 rounded-md border p-2.5 bg-muted/30">
						<p className="text-[10px] text-muted-foreground font-medium">Preview</p>
						<audio
							ref={audioRef}
							src={generatedAudioUrl}
							controls
							className="w-full h-8"
						/>
						<Button
							variant="outline"
							size="sm"
							className="w-full text-[11px]"
							onClick={handleAddToTimeline}
						>
							Add to timeline as voice track
						</Button>
					</div>
				)}
			</div>
		</PanelView>
	);
}

function getAudioDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio(url);
		audio.addEventListener("loadedmetadata", () => {
			resolve(audio.duration);
		});
		audio.addEventListener("error", () => {
			resolve(5); // fallback
		});
	});
}
