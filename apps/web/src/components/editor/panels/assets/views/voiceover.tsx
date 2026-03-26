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
import {
	SARVAM_TTS_LANGUAGES,
	SARVAM_LANGUAGE_MAP,
	SARVAM_TTS_SPEAKERS,
	SARVAM_DEFAULT_SPEAKER,
} from "@/constants/sarvam-constants";
import {
	SMALLEST_TTS_LANGUAGES,
	SMALLEST_TTS_VOICES,
	SMALLEST_DEFAULT_VOICE,
	getSmallestVoicesForLanguage,
} from "@/constants/smallest-constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TTSEngine = "local" | "sarvam" | "smallest";

const TTS_MODELS = [
	{ id: "xtts_v2", name: "Coqui XTTS v2", description: "Multilingual with voice cloning", size: "~1.8 GB", supportsCloning: true, quality: "High", speed: "Slow", installed: true },
	{ id: "styletts2", name: "StyleTTS 2", description: "Human-level quality with style transfer", size: "~500 MB", supportsCloning: true, quality: "Very High", speed: "Medium", installed: false },
	{ id: "bark", name: "Bark (Suno)", description: "Expressive speech with emotions", size: "~5 GB", supportsCloning: false, quality: "Very High", speed: "Very Slow", installed: false },
	{ id: "piper", name: "Piper", description: "Fast and lightweight", size: "~50 MB/voice", supportsCloning: false, quality: "Good", speed: "Very Fast", installed: false },
	{ id: "fish-speech", name: "Fish Speech", description: "Multilingual zero-shot voice cloning", size: "~1 GB", supportsCloning: true, quality: "High", speed: "Fast", installed: false },
	{ id: "kokoro", name: "Kokoro TTS", description: "Small, fast, surprisingly natural", size: "~80 MB", supportsCloning: false, quality: "High", speed: "Very Fast", installed: false },
];

const COQUI_LANGUAGES = [
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

const ALL_TTS_LANGUAGES = [
	...COQUI_LANGUAGES,
	...SARVAM_TTS_LANGUAGES.filter((l) => l.code !== "en"),
	...SMALLEST_TTS_LANGUAGES.filter(
		(l) => !COQUI_LANGUAGES.some((c) => c.code === l.code) && !SARVAM_TTS_LANGUAGES.some((s) => s.code === l.code),
	),
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceoverView() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const hasTranscript = segments.length > 0;

	// Engine selection — top-level toggle
	const [engine, setEngine] = useState<TTSEngine>("local");

	// Shared state
	const [language, setLanguage] = useState("en");
	const [customText, setCustomText] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationProgress, setGenerationProgress] = useState("");
	const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
	const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [useTranscript, setUseTranscript] = useState(true);
	const audioRef = useRef<HTMLAudioElement>(null);

	// Local engine state
	const [selectedModel, setSelectedModel] = useState("xtts_v2");
	const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
	const [clonedVoicePath, setClonedVoicePath] = useState<string | null>(null);
	const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Sarvam engine state
	const [sarvamSpeaker, setSarvamSpeaker] = useState(SARVAM_DEFAULT_SPEAKER);

	// Smallest AI engine state
	const [smallestVoice, setSmallestVoice] = useState(SMALLEST_DEFAULT_VOICE);
	const [smallestSpeed, setSmallestSpeed] = useState(1.0);

	const currentModel = TTS_MODELS.find((m) => m.id === selectedModel) ?? TTS_MODELS[0];

	// Available voices for the selected language (Smallest)
	const smallestVoicesForLang = useMemo(
		() => getSmallestVoicesForLanguage(language),
		[language],
	);

	// Reset language when switching engine
	const handleEngineChange = (value: string) => {
		const e = value as TTSEngine;
		setEngine(e);
		if (e === "sarvam") setLanguage("hi");
		else if (e === "smallest") setLanguage("en");
		else setLanguage("en");
	};

	// Auto-select cloning model when voice is uploaded
	useEffect(() => {
		if (clonedVoicePath) {
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

	// Translate text for TTS
	const translateForTTS = useCallback(async (text: string, taskId?: string): Promise<string> => {
		if (!needsTranslation) return text;
		const langName = ALL_TTS_LANGUAGES.find((l) => l.code === language)?.name ?? language;
		const progress = `Translating to ${langName}...`;
		setGenerationProgress(progress);
		if (taskId) updateTask(taskId, { progress });

		if (engine === "sarvam") {
			const sourceSarvamCode = SARVAM_LANGUAGE_MAP[transcriptLanguage] || `${transcriptLanguage}-IN`;
			const targetSarvamCode = SARVAM_LANGUAGE_MAP[language] || `${language}-IN`;
			try {
				const result = await aiClient.sarvamTranslate(text, sourceSarvamCode, targetSarvamCode);
				return result.translated_text || text;
			} catch {
				return await aiClient.translateText(text, langName);
			}
		}
		return await aiClient.translateText(text, langName);
	}, [needsTranslation, language, engine, transcriptLanguage, updateTask]);

	// Generate speech using the selected engine
	const generateSpeech = useCallback(async (text: string): Promise<Blob> => {
		if (engine === "sarvam") {
			const sarvamCode = SARVAM_LANGUAGE_MAP[language] || `${language}-IN`;
			return aiClient.sarvamTTS(text, sarvamCode, sarvamSpeaker);
		}
		if (engine === "smallest") {
			return aiClient.smallestTTS(text, smallestVoice, language, smallestSpeed);
		}
		return aiClient.generateSpeechBlob({
			text,
			language,
			speakerWav: clonedVoicePath ?? undefined,
			speaker: clonedVoicePath ? undefined : voiceGender,
		});
	}, [engine, language, sarvamSpeaker, smallestVoice, smallestSpeed, clonedVoicePath, voiceGender]);

	// Generate full voiceover
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

			const blob = await generateSpeech(ttsText);

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
	}, [textToGenerate, translateForTTS, generateSpeech, addTask, updateTask]);

	// Generate per-segment and auto-add to timeline
	const handleGeneratePerSegment = useCallback(async () => {
		if (!hasTranscript || segments.length === 0) {
			toast.error("No transcript segments to generate from");
			return;
		}

		const taskId = `vo-seg-${Date.now()}`;
		const langName = ALL_TTS_LANGUAGES.find((l) => l.code === language)?.name ?? language;
		addTask({ id: taskId, type: "voiceover", label: `Voiceover (${segments.length} segments)`, progress: "Starting..." });

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
					ttsText = await translateForTTS(originalText, taskId);
				}

				const progress = `Generating ${i + 1}/${segments.length}...`;
				setGenerationProgress(progress);
				updateTask(taskId, { progress });

				const blob = await generateSpeech(ttsText);

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
	}, [segments, hasTranscript, language, needsTranslation, editor, translateForTTS, generateSpeech, addTask, updateTask]);

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

	// Upload voice sample for cloning (local engine only)
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

	// Can generate?
	const canGenerate = engine === "sarvam" || engine === "smallest" || currentModel.installed;

	return (
		<PanelView title="Voiceover">
			<div className="flex flex-col gap-4">

				{/* ── Source text ── */}
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

				{/* ── Engine selector ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Voice engine</Label>
					<Select value={engine} onValueChange={handleEngineChange}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="local">Local (Coqui XTTS)</SelectItem>
							<SelectItem value="sarvam">Sarvam AI (Indian Languages)</SelectItem>
							<SelectItem value="smallest">Smallest AI (Lightning TTS)</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-[10px] text-muted-foreground">
						{engine === "sarvam"
							? "Cloud — 10 Indian languages, 37+ natural speakers"
							: engine === "smallest"
								? "Cloud — 15 languages, 80+ voices, ~100ms latency"
								: "On-device — 12 global languages, voice cloning"}
					</p>
				</div>

				{/* ── Engine-specific UI ── */}
				{engine === "sarvam" ? (
					<>
						{/* Sarvam: Language */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Language</Label>
							<Select value={language} onValueChange={setLanguage}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SARVAM_TTS_LANGUAGES.filter((l) => l.code !== "en").map((lang) => (
										<SelectItem key={lang.code} value={lang.code}>
											{lang.name}
										</SelectItem>
									))}
									<SelectItem value="en">English (Indian)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Sarvam: Speaker */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Speaker</Label>
							<Select value={sarvamSpeaker} onValueChange={setSarvamSpeaker}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SARVAM_TTS_SPEAKERS.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											{s.name} ({s.gender})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{needsTranslation && (
							<div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5">
								<p className="text-[10px] text-blue-400 leading-relaxed">
									Transcript will be auto-translated to {ALL_TTS_LANGUAGES.find((l) => l.code === language)?.name || language} via Sarvam before generating speech.
								</p>
							</div>
						)}
					</>
				) : engine === "smallest" ? (
					<>
						{/* Smallest: Language */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Language</Label>
							<Select value={language} onValueChange={(val) => {
								setLanguage(val);
								const voicesForLang = getSmallestVoicesForLanguage(val);
								if (voicesForLang.length > 0) {
									if (!voicesForLang.some((v) => v.id === smallestVoice)) {
										setSmallestVoice(voicesForLang[0].id);
									}
								} else {
									// No dedicated voices for this language — fall back to English default
									const enVoices = getSmallestVoicesForLanguage("en");
									if (!enVoices.some((v) => v.id === smallestVoice)) {
										setSmallestVoice(enVoices[0]?.id ?? "emily");
									}
								}
							}}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SMALLEST_TTS_LANGUAGES.map((lang) => (
										<SelectItem key={lang.code} value={lang.code}>
											{lang.name}
											{lang.status === "beta" && " (Beta)"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Smallest: Voice */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Voice</Label>
							<Select value={smallestVoice} onValueChange={setSmallestVoice}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(smallestVoicesForLang.length > 0 ? smallestVoicesForLang : SMALLEST_TTS_VOICES.filter((v) => v.language === "en")).map((v) => (
										<SelectItem key={v.id} value={v.id}>
											{v.name} ({v.gender})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Smallest: Speed */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Speed ({smallestSpeed.toFixed(1)}x)</Label>
							<input
								type="range"
								min={0.5}
								max={2.0}
								step={0.1}
								value={smallestSpeed}
								onChange={(e) => setSmallestSpeed(parseFloat(e.target.value))}
								className="w-full accent-primary"
							/>
							<div className="flex justify-between text-[9px] text-muted-foreground">
								<span>0.5x</span>
								<span>1.0x</span>
								<span>2.0x</span>
							</div>
						</div>

						{needsTranslation && (
							<div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5">
								<p className="text-[10px] text-blue-400 leading-relaxed">
									Transcript will be auto-translated to {ALL_TTS_LANGUAGES.find((l) => l.code === language)?.name || language} before generating speech.
								</p>
							</div>
						)}
					</>
				) : (
					<>
						{/* Local: Language */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs">Language</Label>
							<Select value={language} onValueChange={setLanguage}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COQUI_LANGUAGES.map((lang) => (
										<SelectItem key={lang.code} value={lang.code}>
											{lang.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{needsTranslation && (
								<div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5">
									<p className="text-[10px] text-blue-400 leading-relaxed">
										Transcript will be auto-translated to {COQUI_LANGUAGES.find((l) => l.code === language)?.name || language} before generating speech.
									</p>
								</div>
							)}
						</div>

						{/* Local: Voice type */}
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

						{/* Local: Voice cloning */}
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
										Upload 10-30s audio to clone a specific voice.
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

						{/* Local: Model */}
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
					</>
				)}

				{/* ── Errors & progress ── */}
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

				{/* ── Generate buttons ── */}
				<div className="flex flex-col gap-1.5">
					{hasTranscript && useTranscript && (
						<Button
							className="w-full"
							onClick={handleGeneratePerSegment}
							disabled={isGenerating || !canGenerate}
						>
							{isGenerating && <Spinner className="mr-1" />}
							Generate per segment
						</Button>
					)}

					<Button
						variant={hasTranscript && useTranscript ? "outline" : "default"}
						className="w-full"
						onClick={handleGenerate}
						disabled={isGenerating || !textToGenerate || !canGenerate}
					>
						{isGenerating && !generationProgress.includes("segment") && <Spinner className="mr-1" />}
						Generate full voiceover
					</Button>

					{engine === "local" && !currentModel.installed && (
						<p className="text-[10px] text-yellow-500 text-center">
							This model is not installed. Use Coqui XTTS v2 (installed) or install this model on the backend.
						</p>
					)}
				</div>

				{/* ── Audio preview ── */}
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
			resolve(5);
		});
	});
}
