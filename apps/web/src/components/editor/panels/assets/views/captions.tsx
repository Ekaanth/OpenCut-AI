import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { WHISPER_LANGUAGES } from "@/constants/transcription-constants";
import { LANGUAGES } from "@/constants/language-constants";
import {
	SARVAM_STT_LANGUAGES,
	SARVAM_LANGUAGE_MAP,
	SARVAM_SUPPORTED_CODES,
	isSarvamSTTSupported,
} from "@/constants/sarvam-constants";
import { SMALLEST_STT_LANGUAGES } from "@/constants/smallest-constants";
import type {
	TranscriptionLanguage,
	TranscriptionEngine,
} from "@/types/transcription";
import type { TranscriptionResult } from "@/types/ai";

import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { useTranscriptStore } from "@/stores/transcript-store";
import { getElementsAtTime, hasMediaId } from "@/lib/timeline";
import { toast } from "sonner";
import { aiClient } from "@/lib/ai-client";
import type { TimelineElement } from "@/types/timeline";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { downloadBlob } from "@/utils/browser";
import { NLLB_LANGUAGES } from "@/lib/nllb-languages";

interface SubtitleTrackInfo {
	trackId: string;
	language: string;
}

/** Check if we should use Sarvam for translation (Indian language pair).
 *  Requires at least one side to be an Indian language (not just "en"),
 *  AND the other side must also be Sarvam-supported.
 */
const shouldUseSarvamTranslation = (
	sourceLang: string,
	targetLang: string,
): boolean => {
	const sourceIsSarvam = SARVAM_SUPPORTED_CODES.has(sourceLang);
	const targetIsSarvam = SARVAM_SUPPORTED_CODES.has(targetLang);
	// Both must be Sarvam-supported, and at least one must be a non-English Indian language
	const sourceIsIndian = sourceIsSarvam && sourceLang !== "en";
	const targetIsIndian = targetIsSarvam && targetLang !== "en";
	return (sourceIsIndian || targetIsIndian) && sourceIsSarvam && targetIsSarvam;
};

/**
 * Translate transcript segments into a target language.
 *
 * Strategy (privacy-first):
 *   1. NLLB-200 batch translation via the local translate-service (one request,
 *      fully offline). Preferred — no text leaves the host.
 *   2. If NLLB is unavailable AND the pair is Indian-language with a Sarvam
 *      key configured, fall back to Sarvam cloud translation per segment.
 *   3. Final fallback: the local LLM (`translateText`) in small batches.
 *      Slower and lower quality, but always available.
 *
 * Timing (`start`/`end`) is inherited from the source segments — only `text`
 * changes, so no audio re-analysis is needed.
 */
async function translateSegments(
	segments: { text: string; start: number; end: number }[],
	opts: {
		targetCode: string;
		targetName: string;
		sourceCode: string;
		onProgress?: (step: string) => void;
	},
): Promise<{ text: string; start: number; end: number }[]> {
	const { targetCode, targetName, sourceCode, onProgress } = opts;
	const texts = segments.map((s) => s.text);
	const sameLang = sourceCode === targetCode;

	if (sameLang) {
		return segments.map((s) => ({ ...s }));
	}

	// 1. NLLB batch (preferred — local).
	onProgress?.(`Translating to ${targetName} via NLLB…`);
	try {
		const translations = await aiClient.nllbTranslateBatch(
			texts,
			targetCode,
			sourceCode,
		);
		return segments.map((s, i) => ({
			text: translations[i] ?? s.text,
			start: s.start,
			end: s.end,
		}));
	} catch (nllbErr) {
		console.warn("NLLB translation unavailable, falling back:", nllbErr);
	}

	// 2. Sarvam fallback (Indian languages only, cloud).
	if (shouldUseSarvamTranslation(sourceCode, targetCode)) {
		const sourceSarvamCode = SARVAM_LANGUAGE_MAP[sourceCode] || `${sourceCode}-IN`;
		const targetSarvamCode = SARVAM_LANGUAGE_MAP[targetCode] || `${targetCode}-IN`;
		const out: { text: string; start: number; end: number }[] = [];
		for (let i = 0; i < segments.length; i++) {
			onProgress?.(`Translating to ${targetName} (Sarvam) ${i + 1}/${segments.length}`);
			try {
				const result = await aiClient.sarvamTranslate(
					segments[i].text,
					sourceSarvamCode,
					targetSarvamCode,
				);
				out.push({
					text: result.translated_text || segments[i].text,
					start: segments[i].start,
					end: segments[i].end,
				});
			} catch {
				out.push({ ...segments[i] });
			}
		}
		return out;
	}

	// 3. LLM fallback (always available, slower/lower quality).
	const BATCH_SIZE = 5;
	const out: { text: string; start: number; end: number }[] = [];
	for (let i = 0; i < segments.length; i += BATCH_SIZE) {
		const batch = segments.slice(i, i + BATCH_SIZE);
		const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(segments.length / BATCH_SIZE);
		onProgress?.(`Translating to ${targetName} (LLM) ${batchIndex}/${totalBatches}`);
		const numberedLines = batch.map((seg, idx) => `${idx + 1}. ${seg.text}`).join("\n");
		const translated = await aiClient.translateText(numberedLines, targetName);
		const lines = translated
			.split("\n")
			.map((line) => line.replace(/^\d+\.\s*/, "").trim())
			.filter((line) => line.length > 0);
		for (let j = 0; j < batch.length; j++) {
			out.push({
				text: lines[j] || batch[j].text,
				start: batch[j].start,
				end: batch[j].end,
			});
		}
	}
	return out;
}

export function Captions() {
	const [selectedEngine, setSelectedEngine] = useState<TranscriptionEngine>("whisper");
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
	const [translateLanguage, setTranslateLanguage] = useState("es");
	const [isTranslating, setIsTranslating] = useState(false);
	const [translatingStep, setTranslatingStep] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const segments = useTranscriptStore((s) => s.segments);
	const editor = useEditor();

	// Determine which languages to show based on engine
	const availableLanguages = selectedEngine === "sarvam"
		? SARVAM_STT_LANGUAGES
		: selectedEngine === "smallest"
			? SMALLEST_STT_LANGUAGES
			: WHISPER_LANGUAGES;

	// Filter out tracks that no longer exist on the timeline (user may have deleted them)
	const timelineTracks = editor.timeline.getTracks();
	const timelineTrackIds = new Set(timelineTracks.map((t) => t.id));
	const activeSubtitleTracks = subtitleTracks.filter((t) =>
		timelineTrackIds.has(t.trackId),
	);

	// Sync state if tracks were removed externally
	if (activeSubtitleTracks.length !== subtitleTracks.length) {
		// Use a microtask to avoid setState during render
		queueMicrotask(() => setSubtitleTracks(activeSubtitleTracks));
	}

	/** Determine the effective engine for a given language code */
	const getEffectiveEngine = (langCode: string): TranscriptionEngine => {
		if (selectedEngine === "sarvam") return "sarvam";
		if (selectedEngine === "smallest") return "smallest";
		// Auto-switch to Sarvam if an Indian language is explicitly selected with Whisper
		if (langCode !== "auto" && isSarvamSTTSupported(langCode) && !WHISPER_LANGUAGES.some(l => l.code === langCode)) {
			return "sarvam";
		}
		return "whisper";
	};

	const handleGenerateTranscript = async () => {
		const taskId = `transcription-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		try {
			setIsProcessing(true);
			setError(null);

			const engine = getEffectiveEngine(selectedLanguage);
			const engineLabel = engine === "sarvam" ? "Sarvam AI" : engine === "smallest" ? "Smallest AI" : "Whisper";

			bgTasks.addTask({
				id: taskId,
				type: "transcription",
				label: `Transcription (${engineLabel})`,
				progress: "Starting...",
			});

			// Remove existing subtitle tracks before re-transcribing
			for (const track of activeSubtitleTracks) {
				try {
					editor.timeline.removeTrack({ trackId: track.trackId });
				} catch {
					// Track may already be gone
				}
			}
			setSubtitleTracks([]);

			// Find the media file from the timeline
			setProcessingStep("Finding media...");
			bgTasks.updateTask(taskId, { progress: "Finding media..." });
			const tracks = editor.timeline.getTracks();
			let foundMediaId: string | null = null;

			for (const track of tracks) {
				for (const element of track.elements) {
					if (
						(track.type === "video" || track.type === "audio") &&
						hasMediaId(element as TimelineElement)
					) {
						foundMediaId = (element as TimelineElement & { mediaId: string }).mediaId;
						break;
					}
				}
				if (foundMediaId) break;
			}

			if (!foundMediaId) {
				setError("No video or audio found on the timeline. Import a file first.");
				return;
			}

			const mediaAsset = editor.media
				.getAssets()
				.find((asset) => asset.id === foundMediaId);

			if (!mediaAsset?.file) {
				setError("Cannot access the media file for transcription.");
				return;
			}

			// Send to appropriate transcription service
			setProcessingStep(`Transcribing via ${engineLabel}...`);
			bgTasks.updateTask(taskId, { progress: `Transcribing via ${engineLabel}...` });

			// Ensure the file has a proper extension — the backend rejects files without one
			const mimeToExt: Record<string, string> = {
				"video/mp4": ".mp4",
				"video/webm": ".webm",
				"video/quicktime": ".mov",
				"video/x-matroska": ".mkv",
				"video/avi": ".avi",
				"audio/mpeg": ".mp3",
				"audio/wav": ".wav",
				"audio/x-wav": ".wav",
				"audio/ogg": ".ogg",
				"audio/flac": ".flac",
				"audio/aac": ".aac",
				"audio/mp4": ".m4a",
			};

			let file = mediaAsset.file;
			const fileName = file.name || "";
			const hasExtension = fileName.includes(".") && (fileName.split(".").pop()?.length ?? 0) > 0;

			if (!hasExtension) {
				const ext = mimeToExt[file.type] || ".mp4";
				const newName = fileName ? `${fileName}${ext}` : `media${ext}`;
				file = new File([file], newName, { type: file.type || "video/mp4" });
			}

			let result: TranscriptionResult;
			if (engine === "sarvam") {
				// Use Sarvam AI for Indian languages
				const sarvamLangCode = selectedLanguage === "auto"
					? undefined
					: SARVAM_LANGUAGE_MAP[selectedLanguage] || undefined;
				result = await aiClient.sarvamTranscribe(file, sarvamLangCode);
			} else if (engine === "smallest") {
				// Use Smallest AI Pulse for multilingual STT
				const language = selectedLanguage === "auto" ? "en" : selectedLanguage;
				result = await aiClient.smallestTranscribe(file, language);
			} else {
				// Use Whisper (local)
				const language = selectedLanguage === "auto" ? undefined : selectedLanguage;
				result = await aiClient.transcribe(file, language);
			}

			setProcessingStep("Processing segments...");
			bgTasks.updateTask(taskId, { progress: "Processing segments..." });

			const timelineDuration = editor.timeline.getTotalDuration();

			// Filter out hallucinated segments beyond the actual duration
			// For Sarvam results, also allow Indic Unicode ranges through
			const validSegments = result.segments.filter((seg) => {
				if (seg.start >= timelineDuration) return false;
				// Keep Latin, Cyrillic, CJK, Kana, Devanagari, Bengali, Gurmukhi, Gujarati,
			// Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala, Arabic/Nastaliq (Urdu),
			// Meitei (Manipuri), Ol Chiki (Santali)
			const cleanText = seg.text.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\uABC0-\uABFF\u1C50-\u1C7F]/g, "").trim();
				if (cleanText.length === 0) return false;
				if (seg.end <= seg.start) return false;
				return true;
			}).map((seg) => ({
				...seg,
				end: Math.min(seg.end, timelineDuration),
			}));

			if (validSegments.length === 0) {
				setError("No speech detected in the video. Try a different language or check that the video has audio.");
				return;
			}

			// Populate transcript store — segments already have word-level detail from backend
			const transcriptSegments = validSegments.map((seg, index) => ({
				id: index,
				text: seg.text,
				start: seg.start,
				end: seg.end,
				words: seg.words && seg.words.length > 0
					? seg.words.map((w) => ({
						word: w.word,
						start: w.start,
						end: w.end,
						confidence: w.confidence,
					}))
					: seg.text.trim().split(/\s+/).map((word, wordIndex, arr) => {
						const segDuration = seg.end - seg.start;
						const wordDuration = segDuration / arr.length;
						return {
							word,
							start: seg.start + wordIndex * wordDuration,
							end: seg.start + (wordIndex + 1) * wordDuration,
							confidence: 0.9,
						};
					}),
			}));

			useTranscriptStore.getState().setSegments(transcriptSegments);
			useTranscriptStore.getState().setLanguage(result.language ?? "en");

			// ── Auto Speaker Diarization + Emotion Detection ──
			// Run both in parallel: speaker labels and emotion annotations.
			const speakerChangeTimes: number[] = [];
			setProcessingStep("Detecting speakers & emotions...");
			bgTasks.updateTask(taskId, { progress: "Detecting speakers & emotions..." });

			const speakerPromise = aiClient.analyzeSpeakers(file).catch((err) => {
				console.warn("Speaker diarization failed:", err);
				return null;
			});
			const emotionPromise = aiClient.analyzeEmotions(file).catch((err) => {
				console.warn("Emotion detection failed:", err);
				return null;
			});

			const [speakerResult, emotionResult] = await Promise.all([speakerPromise, emotionPromise]);

			if (speakerResult && speakerResult.segments.length > 0) {
				useTranscriptStore.getState().applySpeakerDiarization(speakerResult.segments);

				// Collect speaker change boundaries for auto-cuts
				for (let i = 1; i < speakerResult.segments.length; i++) {
					const prev = speakerResult.segments[i - 1];
					const curr = speakerResult.segments[i];
					if (prev.speaker !== curr.speaker) {
						const boundary = curr.start;
						if (boundary > 0 && boundary < timelineDuration) {
							speakerChangeTimes.push(boundary);
						}
					}
				}

				const numSpeakers = speakerResult.num_speakers;
				if (numSpeakers > 1) {
					toast.success(`Detected ${numSpeakers} speakers`, {
						description: `Method: ${speakerResult.method}. Click speaker names in the transcript to rename them.`,
					});
				}
			}

			if (emotionResult && emotionResult.emotions.length > 0) {
				useTranscriptStore.getState().setEmotions(emotionResult.emotions);
			}

			// Split video at segment boundaries AND speaker change points
			if (validSegments.length > 1) {
				try {
					const allTimes = new Set<number>();
					for (const seg of validSegments) {
						if (seg.start > 0 && seg.start < timelineDuration) {
							allTimes.add(seg.start);
						}
						if (seg.end > 0 && seg.end < timelineDuration) {
							allTimes.add(seg.end);
						}
					}
					// Add speaker change boundaries
					for (const t of speakerChangeTimes) {
						allTimes.add(t);
					}

					let splitCount = 0;
					const reversed = [...allTimes].sort((a, b) => b - a);
					for (const time of reversed) {
						const elementsAtTime = getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time,
						});
						if (elementsAtTime.length > 0) {
							editor.timeline.splitElements({
								elements: elementsAtTime,
								splitTime: time,
							});
							splitCount++;
						}
					}

					if (splitCount > 0) {
						toast.success(`Video split into ${splitCount + 1} segments`, {
							description: "Delete or reorder segments in the transcript panel to edit the video.",
						});
					}
				} catch (splitError) {
					console.error("Failed to split video:", splitError);
				}
			}

			// Auto-separate audio from video so it appears as its own track
			const tracksAfterSplit = editor.timeline.getTracks();
			for (const track of tracksAfterSplit) {
				if (track.type !== "video") continue;
				for (const el of track.elements) {
					const videoEl = el as TimelineElement & { mediaId?: string; muted?: boolean };
					if (!videoEl.mediaId || videoEl.muted) continue;

					// Mute the video element and create a matching audio element
					editor.timeline.updateElements({
						updates: [{
							trackId: track.id,
							elementId: el.id,
							updates: { muted: true },
						}],
					});

					editor.timeline.insertElement({
						element: {
							type: "audio",
							sourceType: "upload",
							mediaId: videoEl.mediaId,
							name: `${el.name} (audio)`,
							startTime: el.startTime,
							duration: el.duration,
							trimStart: el.trimStart,
							trimEnd: el.trimEnd,
							sourceDuration: el.sourceDuration,
							volume: 1,
						},
						placement: { mode: "auto" },
					});
				}
			}

			setSubtitleTracks([]);

			toast.success(`Transcription complete (${engineLabel})`, {
				description: `${validSegments.length} segments detected`,
			});

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `${validSegments.length} segments`,
				completedAt: Date.now(),
			});
		} catch (err) {
			console.error("Transcription failed:", err);
			const message = err instanceof Error ? err.message : "An unexpected error occurred";
			if (message.includes("Cannot connect") || message.includes("connection_refused")) {
				setError("Cannot connect to AI backend. Make sure it is running (docker compose up -d).");
			} else if (message.includes("Sarvam API key")) {
				setError("Sarvam API key is not configured. Add OPENCUTAI_SARVAM_API_KEY to your environment.");
			} else if (message.includes("Smallest AI API key")) {
				setError("Smallest AI API key is not configured. Add it in Settings > API Keys, or set OPENCUTAI_SMALLEST_API_KEY in your environment.");
			} else {
				setError(message);
			}
			bgTasks.updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
		}
	};

	const addSubtitleTrack = ({
		subtitleSegments,
		languageLabel,
		yOffset = 0.38,
	}: {
		subtitleSegments: {
			text: string;
			start: number;
			end: number;
			words?: { word: string; start: number; end: number }[];
		}[];
		languageLabel: string;
		yOffset?: number;
	}) => {
		const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
		editor.timeline.renameTrack({
			trackId,
			name: `Subs: ${languageLabel}`,
		});
		const canvasSize = editor.project.getActive().settings.canvasSize;
		const subtitleY = canvasSize.height * yOffset;

		for (let i = 0; i < subtitleSegments.length; i++) {
			const seg = subtitleSegments[i];

			// Build word timings relative to the element's local time (0-based)
			const wordTimings = seg.words?.map((w) => ({
				word: w.word,
				start: w.start - seg.start,
				end: w.end - seg.start,
			}));

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: `${languageLabel} ${i + 1}`,
					content: seg.text,
					duration: seg.end - seg.start,
					startTime: seg.start,
					fontSize: 4,
					fontWeight: "bold",
					color: "#ffffff",
					highlightColor: "#FACC15",
					...(wordTimings && wordTimings.length > 0 ? { wordTimings } : {}),
					textAlign: "center",
					background: {
						enabled: true,
						color: "#000000",
						cornerRadius: 4,
						paddingX: 12,
						paddingY: 6,
						offsetX: 0,
						offsetY: 0,
					},
					opacity: 0.95,
					transform: {
						scale: 1,
						position: { x: 0, y: subtitleY },
						rotate: 0,
					},
				},
			});
		}

		return trackId;
	};

	const handleAddSubtitles = () => {
		const currentSegments = useTranscriptStore.getState().segments;
		if (currentSegments.length === 0) return;

		const trackId = addSubtitleTrack({
			subtitleSegments: currentSegments.map((seg) => ({
				text: seg.text,
				start: seg.start,
				end: seg.end,
				words: seg.words,
			})),
			languageLabel: "Subtitle",
		});

		setSubtitleTracks((prev) => [...prev, { trackId, language: "original" }]);
		toast.success("Subtitles added with word highlighting");
	};

	const handleTranslateAndAdd = async () => {
		const currentSegments = useTranscriptStore.getState().segments;
		if (currentSegments.length === 0) return;

		const targetLang = LANGUAGES.find((l) => l.code === translateLanguage);
		if (!targetLang) return;

		const taskId = `translation-${targetLang.code}-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		setIsTranslating(true);
		setError(null);

		bgTasks.addTask({
			id: taskId,
			type: "translation",
			label: `${targetLang.name} translation`,
			progress: "Starting...",
		});

		try {
			const translatedSegments = await translateSegments(currentSegments, {
				targetCode: targetLang.code,
				targetName: targetLang.name,
				sourceCode: useTranscriptStore.getState().language,
				onProgress: (step) => {
					setTranslatingStep(step);
					bgTasks.updateTask(taskId, { progress: step });
				},
			});

			// Place translated subtitles slightly above the original ones
			const yOffset = activeSubtitleTracks.length > 0 ? 0.28 : 0.38;
			const trackId = addSubtitleTrack({
				subtitleSegments: translatedSegments,
				languageLabel: `${targetLang.name}`,
				yOffset,
			});

			setSubtitleTracks((prev) => [
				...prev,
				{ trackId, language: targetLang.code },
			]);

			// Store translation in transcript store for the tabbed panel
			useTranscriptStore.getState().addTranslation({
				languageCode: targetLang.code,
				languageName: targetLang.name,
				segments: translatedSegments.map((seg, idx) => ({
					id: idx,
					text: seg.text,
					start: seg.start,
					end: seg.end,
					words: [],
				})),
			});

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `${translatedSegments.length} segments`,
				completedAt: Date.now(),
			});
		} catch (err) {
			console.error("Translation failed:", err);
			const message =
				err instanceof Error ? err.message : "Translation failed";
			if (
				message.includes("Cannot connect") ||
				message.includes("connection_refused")
			) {
				setError(
					"Cannot connect to AI backend. Make sure it is running and an LLM model is loaded.",
				);
			} else if (message.includes("Sarvam API key")) {
				setError("Sarvam API key is not configured. Add OPENCUTAI_SARVAM_API_KEY to your environment.");
			} else if (message.includes("Smallest AI API key")) {
				setError("Smallest AI key is not configured. Add it in Settings > API Keys, or set OPENCUTAI_SMALLEST_API_KEY in your environment.");
			} else {
				setError(message);
			}
			bgTasks.updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
		} finally {
			setIsTranslating(false);
			setTranslatingStep("");
		}
	};

	const handleRemoveSubtitles = () => {
		for (const track of subtitleTracks) {
			try {
				editor.timeline.removeTrack({ trackId: track.trackId });
			} catch {
				// Track may already have been removed manually
			}
		}
		setSubtitleTracks([]);
		toast.success("All subtitle tracks removed");
	};

	const handleRemoveSingleTrack = (trackId: string) => {
		try {
			editor.timeline.removeTrack({ trackId });
		} catch {
			// Already removed
		}
		setSubtitleTracks((prev) => prev.filter((t) => t.trackId !== trackId));
		toast.success("Subtitle track removed");
	};

	const handleExportSubtitles = async (
		track: SubtitleTrackInfo,
		format: "srt" | "vtt",
	) => {
		// Prefer the stored translation (clean text); fall back to the live
		// timeline track's text elements if no translation is stored.
		const stored = useTranscriptStore
			.getState()
			.translations.find((t) => t.languageCode === track.language);
		const segments = stored?.segments ?? [];
		if (segments.length === 0) {
			toast.error("No segments to export for this track.");
			return;
		}
		const taskId = `sub-export-${track.language}-${Date.now()}`;
		useBackgroundTasksStore.getState().addTask({
			id: taskId,
			type: "popover-subs",
			label: `Exporting ${track.language}.${format}`,
			progress: "Generating…",
		});
		try {
			const result = await aiClient.generateSubtitles(segments, format);
			const blob = new Blob([result.content], {
				type: format === "srt" ? "application/x-subrip" : "text/vtt",
			});
			downloadBlob({
				blob,
				filename: `subtitles-${track.language}.${format}`,
			});
			useBackgroundTasksStore.getState().updateTask(taskId, {
				status: "completed",
				progress: "Downloaded",
				completedAt: Date.now(),
			});
			toast.success(`Exported subtitles-${track.language}.${format}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Export failed";
			useBackgroundTasksStore.getState().updateTask(taskId, {
				status: "error",
				error: msg,
				completedAt: Date.now(),
			});
			toast.error("Subtitle export failed", { description: msg });
		}
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}
		setSelectedLanguage(value as TranscriptionLanguage);
	};

	const handleEngineChange = (value: string) => {
		const engine = value as TranscriptionEngine;
		setSelectedEngine(engine);
		// Reset language to auto when switching engines
		setSelectedLanguage("auto");
	};

	return (
		<PanelView title="Transcript" ref={containerRef}>
			<div className="flex flex-col gap-5">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Transcribe your video to edit it like a document. Delete sections, remove filler words, or reorder segments.
				</p>

				{/* ── Engine Selector ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Transcription engine</Label>
					<Select value={selectedEngine} onValueChange={handleEngineChange}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="whisper">
								Whisper (Local)
							</SelectItem>
							<SelectItem value="sarvam">
								Sarvam AI (Indian Languages)
							</SelectItem>
							<SelectItem value="smallest">
								Smallest AI Pulse (39 Languages)
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-[10px] text-muted-foreground">
						{selectedEngine === "sarvam"
							? "Cloud-based, optimized for 22 Indian regional languages"
							: selectedEngine === "smallest"
								? "Cloud-based, 39 languages with speaker diarization & emotion detection"
								: "On-device, best for global languages (English, Spanish, French, etc.)"}
					</p>
				</div>

				{/* ── Language Selector ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Language</Label>
					<Select
						value={selectedLanguage}
						onValueChange={(value) => handleLanguageChange({ value })}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a language" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="auto">Auto detect</SelectItem>
							{selectedEngine === "sarvam" ? (
								<>
									<SelectGroup>
										<SelectLabel className="text-[10px] text-muted-foreground px-2">
											Indian Regional Languages
										</SelectLabel>
										{SARVAM_STT_LANGUAGES.filter(l => l.code !== "en").map((language) => (
											<SelectItem key={language.code} value={language.code}>
												{language.name}
											</SelectItem>
										))}
									</SelectGroup>
									<SelectGroup>
										<SelectLabel className="text-[10px] text-muted-foreground px-2">
											English
										</SelectLabel>
										<SelectItem value="en">
											English (Indian)
										</SelectItem>
									</SelectGroup>
								</>
							) : (
								availableLanguages.map((language) => (
									<SelectItem key={language.code} value={language.code}>
										{language.name}
									</SelectItem>
								))
							)}
						</SelectContent>
					</Select>
				</div>

				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
						<p className="text-destructive text-sm">{error}</p>
					</div>
				)}

				{segments.length > 0 && activeSubtitleTracks.length === 0 && (
					<p className="text-[11px] text-muted-foreground leading-relaxed rounded-md bg-muted/50 px-3 py-2">
						Transcript is ready. Add subtitles below, or re-transcribe if the video changed.
					</p>
				)}

				<Button
					className="w-full"
					variant={segments.length > 0 ? "outline" : "default"}
					onClick={handleGenerateTranscript}
					disabled={isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					{isProcessing
						? processingStep
						: segments.length > 0
							? "Re-transcribe"
							: "Generate transcript"}
				</Button>

				{segments.length > 0 && (
					<>
						{/* ── Subtitle Tracks ── */}
						<div className="border-t pt-4 flex flex-col gap-3">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Subtitle tracks</Label>
								{activeSubtitleTracks.length > 0 && (
									<span className="text-[10px] text-muted-foreground tabular-nums">
										{activeSubtitleTracks.length} active
									</span>
								)}
							</div>

							{activeSubtitleTracks.length > 0 ? (
								<div className="flex flex-col gap-1.5">
									{activeSubtitleTracks.map((track) => {
										const langName =
											track.language === "original"
												? "Original"
												: LANGUAGES.find((l) => l.code === track.language)
														?.name ?? track.language;
										return (
											<div
												key={track.trackId}
												className="flex items-center justify-between rounded-md border px-3 py-2"
											>
									<div className="flex items-center gap-2">
										<span className="bg-primary size-1.5 rounded-full shrink-0" />
										<span className="text-sm font-medium">
											{langName}
										</span>
									</div>
									<div className="flex items-center gap-1">
										{track.language !== "original" && (
											<>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
													onClick={() =>
														handleExportSubtitles(track, "srt")
													}
												>
													SRT
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
													onClick={() =>
														handleExportSubtitles(track, "vtt")
													}
												>
													VTT
												</Button>
											</>
										)}
										<Button
											variant="ghost"
											size="sm"
											className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
											onClick={() =>
												handleRemoveSingleTrack(track.trackId)
											}
										>
											Remove
										</Button>
									</div>
											</div>
										);
									})}
									<Button
										variant="outline"
										size="sm"
										className="w-full text-destructive hover:text-destructive"
										onClick={handleRemoveSubtitles}
									>
										Remove all
									</Button>
								</div>
							) : (
								<Button
									variant="outline"
									className="w-full"
									onClick={handleAddSubtitles}
								>
									Add subtitles
								</Button>
							)}
						</div>

						{/* ── Add Language ── */}
						<div className="border-t pt-4 flex flex-col gap-3">
							<Label className="text-xs">Add language</Label>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Translate via the local NLLB-200 service (fully offline). Falls back
								to Sarvam AI for Indian languages or the local LLM if NLLB is
								unavailable.
							</p>

							{/* Quick-add chips: batch-translate into several languages. */}
							<div className="flex flex-wrap gap-1">
								{NLLB_LANGUAGES.filter(
									(l) =>
										l.code !==
											useTranscriptStore.getState().language &&
										!activeSubtitleTracks.some(
											(t) => t.language === l.code,
										),
								).map((lang) => (
									<button
										key={lang.code}
										type="button"
										disabled={isTranslating}
										onClick={() => {
											setTranslateLanguage(lang.code);
											// Defer so state settles before the handler reads it.
											setTimeout(() => handleTranslateAndAdd(), 0);
										}}
										className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-accent disabled:opacity-50 transition-colors"
									>
										{lang.name}
									</button>
								))}
							</div>
							<div className="flex gap-2">
								<Select
									value={translateLanguage}
									onValueChange={setTranslateLanguage}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectLabel className="text-[10px] text-muted-foreground px-2">
												Global Languages
											</SelectLabel>
											{LANGUAGES.filter(
												(lang) =>
													!SARVAM_SUPPORTED_CODES.has(lang.code) &&
													!activeSubtitleTracks.some(
														(t) => t.language === lang.code,
													),
											).map((lang) => (
												<SelectItem key={lang.code} value={lang.code}>
													{lang.name}
												</SelectItem>
											))}
										</SelectGroup>
										<SelectGroup>
											<SelectLabel className="text-[10px] text-muted-foreground px-2">
												Indian Languages (via Sarvam AI)
											</SelectLabel>
											{LANGUAGES.filter(
												(lang) =>
													SARVAM_SUPPORTED_CODES.has(lang.code) &&
													lang.code !== "en" &&
													!activeSubtitleTracks.some(
														(t) => t.language === lang.code,
													),
											).map((lang) => (
												<SelectItem key={lang.code} value={lang.code}>
													{lang.name}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
								<Button
									onClick={handleTranslateAndAdd}
									disabled={isTranslating}
									className="shrink-0"
								>
									{isTranslating && <Spinner className="mr-1" />}
									{isTranslating ? "..." : "Add"}
								</Button>
							</div>
							{isTranslating && translatingStep && (
								<p className="text-[11px] text-muted-foreground animate-pulse">
									{translatingStep}
								</p>
							)}
						</div>
					</>
				)}
			</div>
		</PanelView>
	);
}
