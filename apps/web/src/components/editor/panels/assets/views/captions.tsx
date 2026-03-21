import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { TRANSCRIPTION_LANGUAGES } from "@/constants/transcription-constants";
import { LANGUAGES } from "@/constants/language-constants";
import type { TranscriptionLanguage } from "@/types/transcription";

import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { useTranscriptStore } from "@/stores/transcript-store";
import { getElementsAtTime, hasMediaId } from "@/lib/timeline";
import { toast } from "sonner";
import { aiClient } from "@/lib/ai-client";
import type { TimelineElement } from "@/types/timeline";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";

interface SubtitleTrackInfo {
	trackId: string;
	language: string;
}

export function Captions() {
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

	const handleGenerateTranscript = async () => {
		const taskId = `transcription-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		try {
			setIsProcessing(true);
			setError(null);

			bgTasks.addTask({
				id: taskId,
				type: "transcription",
				label: "Transcription",
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

			// Send to backend Whisper service
			setProcessingStep("Transcribing...");
			bgTasks.updateTask(taskId, { progress: "Transcribing audio..." });

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
			const hasExtension = fileName.includes(".") && fileName.split(".").pop()!.length > 0;

			if (!hasExtension) {
				const ext = mimeToExt[file.type] || ".mp4";
				const newName = fileName ? `${fileName}${ext}` : `media${ext}`;
				file = new File([file], newName, { type: file.type || "video/mp4" });
			}

			const language = selectedLanguage === "auto" ? undefined : selectedLanguage;
			const result = await aiClient.transcribe(file, language);

			setProcessingStep("Processing segments...");
			bgTasks.updateTask(taskId, { progress: "Processing segments..." });

			const timelineDuration = editor.timeline.getTotalDuration();

			// Filter out hallucinated segments beyond the actual duration
			const validSegments = result.segments.filter((seg) => {
				if (seg.start >= timelineDuration) return false;
				const cleanText = seg.text.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, "").trim();
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

			// Split video at segment boundaries so each segment maps to a clip
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
			// Batch segments into groups to reduce LLM calls
			const BATCH_SIZE = 5;
			const translatedSegments: { text: string; start: number; end: number }[] = [];

			for (let i = 0; i < currentSegments.length; i += BATCH_SIZE) {
				const batch = currentSegments.slice(i, i + BATCH_SIZE);
				const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
				const totalBatches = Math.ceil(currentSegments.length / BATCH_SIZE);
				const stepText = `Translating to ${targetLang.name}... (${batchIndex}/${totalBatches})`;
				setTranslatingStep(stepText);
				bgTasks.updateTask(taskId, { progress: stepText });

				// Send batch as numbered lines for reliable parsing
				const numberedLines = batch
					.map((seg, idx) => `${idx + 1}. ${seg.text}`)
					.join("\n");

				const translated = await aiClient.translateText(
					numberedLines,
					targetLang.name,
				);

				// Parse response — expect numbered lines back
				const lines = translated
					.split("\n")
					.map((line) => line.replace(/^\d+\.\s*/, "").trim())
					.filter((line) => line.length > 0);

				for (let j = 0; j < batch.length; j++) {
					translatedSegments.push({
						text: lines[j] || batch[j].text,
						start: batch[j].start,
						end: batch[j].end,
					});
				}
			}

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

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code);
	};

	return (
		<PanelView title="Transcript" ref={containerRef}>
			<div className="flex flex-col gap-5">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Transcribe your video to edit it like a document. Delete sections, remove filler words, or reorder segments.
				</p>

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
							{TRANSCRIPTION_LANGUAGES.map((language) => (
								<SelectItem key={language.code} value={language.code}>
									{language.name}
								</SelectItem>
							))}
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
								Translate using the local LLM and add as a new subtitle track.
							</p>
							<div className="flex gap-2">
								<Select
									value={translateLanguage}
									onValueChange={setTranslateLanguage}
								>
									<SelectTrigger className="flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{LANGUAGES.filter(
											(lang) =>
												!activeSubtitleTracks.some(
													(t) => t.language === lang.code,
												),
										).map((lang) => (
											<SelectItem key={lang.code} value={lang.code}>
												{lang.name}
											</SelectItem>
										))}
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
