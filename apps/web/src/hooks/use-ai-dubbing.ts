import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { aiClient } from "@/lib/ai-client";
import { generateUUID } from "@/utils/id";
import {
	SARVAM_TTS_SUPPORTED_CODES,
	toSarvamCode,
} from "@/constants/sarvam-constants";
import { toast } from "sonner";
import type { TranscriptionSegment } from "@/types/ai";

export type DubbingEngine = "sarvam" | "smallest" | "local";

export interface DubbingOptions {
	targetLanguage: string;
	engine: DubbingEngine;
	voiceId: string;
	pace?: number;
	segmentIndices?: number[];
}

export interface DubbingProgress {
	currentSegment: number;
	totalSegments: number;
	currentText: string;
	phase: "translating" | "generating" | "placing" | "done";
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

export function useAIDubbing() {
	const editor = useEditor();
	const segments = useTranscriptStore((s) => s.segments);
	const language = useTranscriptStore((s) => s.language);
	const addTask = useBackgroundTasksStore((s) => s.addTask);
	const updateTask = useBackgroundTasksStore((s) => s.updateTask);

	const [isDubbing, setIsDubbing] = useState(false);
	const [progress, setProgress] = useState<DubbingProgress | null>(null);

	const runDubbing = useCallback(
		async (options: DubbingOptions) => {
			const targetSegments =
				options.segmentIndices
					?.map((i) => segments[i])
					.filter(Boolean) ?? segments;

			if (targetSegments.length === 0) {
				toast.error("No segments to dub");
				return;
			}

			setIsDubbing(true);
			const taskId = `dubbing-${Date.now()}`;
			addTask({
				id: taskId,
				type: "dubbing",
				label: `Dubbing to ${options.targetLanguage}`,
				progress: `0/${targetSegments.length} segments`,
			});

			const totalSegments = targetSegments.length;

			const tracks = editor.timeline.getTracks();
			let audioTrack = tracks.find((t) => t.type === "audio");
			let trackId = audioTrack?.id;

			if (!trackId) {
				trackId = editor.timeline.addTrack({ type: "audio" });
			}

			try {
				// ── Phase 1: batch-translate all segments up front. ──────────
				// The "local" engine uses the privacy-first NLLB-200 service
				// (one batched request, fully offline). Sarvam stays per-segment
				// because it's a cloud API with a 2000-char cap per call.
				const needsTranslation = language !== options.targetLanguage;
				const isSarvamLang = SARVAM_TTS_SUPPORTED_CODES.has(
					options.targetLanguage,
				);
				const isLocal = options.engine === "local";
				const isSarvam = options.engine === "sarvam" && isSarvamLang;
				const isSmallest = options.engine === "smallest";

				// translations[i] aligns with targetSegments[i]; defaults to the
				// original text when no translation is required/available.
				let translations: string[] = targetSegments.map((s) => s.text);

				if (needsTranslation) {
					setProgress({
						currentSegment: 0,
						totalSegments,
						currentText: "Translating all segments…",
						phase: "translating",
					});
					try {
						if (isLocal) {
							// One batched call to the local NLLB-200 service.
							translations = await aiClient.nllbTranslateBatch(
								targetSegments.map((s) => s.text),
								options.targetLanguage,
								language,
							);
						} else if (isSarvam) {
							const srcCode = toSarvamCode(language) ?? "en-IN";
							const tgtCode =
								toSarvamCode(options.targetLanguage) ?? "hi-IN";
							translations = await Promise.all(
								targetSegments.map((s) =>
									aiClient.sarvamTranslate(s.text, srcCode, tgtCode).then(
										(r) => r.translated_text,
									),
								),
							);
						} else {
							// Smallest engine has no translation API — fall back to
							// LLM translation (slower, lower quality) for non-local.
							translations = await Promise.all(
								targetSegments.map((s) =>
									aiClient.translateText(s.text, options.targetLanguage),
								),
							);
						}
					} catch (translateErr) {
						// If the local translate-service isn't running, fall back to
						// LLM translation so dubbing still works.
						if (isLocal) {
							toast.warning(
								"NLLB translate service unavailable — using LLM fallback.",
							);
							translations = await Promise.all(
								targetSegments.map((s) =>
									aiClient.translateText(s.text, options.targetLanguage),
								),
							);
						} else {
							throw translateErr;
						}
					}
				}

				// ── Phase 2: TTS + place each translated segment. ────────────
				for (let i = 0; i < targetSegments.length; i++) {
					const seg = targetSegments[i];
					const translatedText = translations[i] ?? seg.text;

					setProgress({
						currentSegment: i + 1,
						totalSegments,
						currentText: translatedText.slice(0, 50),
						phase: "generating",
					});

					let audioBlob: Blob;

					if (isSarvam) {
						const sarvamCode =
							toSarvamCode(options.targetLanguage) ?? "hi-IN";
						audioBlob = await aiClient.sarvamTTS(
							translatedText,
							sarvamCode,
							options.voiceId,
							options.pace ?? 1.0,
						);
					} else if (isSmallest) {
						audioBlob = await aiClient.smallestTTS(
							translatedText,
							options.voiceId,
							options.targetLanguage,
							options.pace ?? 1.0,
						);
					} else {
						audioBlob = await aiClient.generateSpeechBlob({
							text: translatedText,
							language: options.targetLanguage,
							speaker: options.voiceId,
						});
					}

					setProgress({
						currentSegment: i + 1,
						totalSegments,
						currentText: translatedText.slice(0, 50),
						phase: "placing",
					});

					const ext = isSarvam || isSmallest ? "mp3" : "wav";
					const mimeType = isSarvam || isSmallest ? "audio/mpeg" : "audio/wav";
					const file = new File([audioBlob], `dub_${generateUUID()}.${ext}`, {
						type: mimeType,
					});
					const audioUrl = URL.createObjectURL(file);
					const duration = await getAudioDuration(audioUrl);

					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId: trackId! },
						element: {
							type: "audio",
							sourceType: "library",
							sourceUrl: audioUrl,
							name: `Dub [${options.targetLanguage}]: ${seg.text.slice(0, 20)}...`,
							startTime: seg.start,
							duration: duration || seg.end - seg.start,
							trimStart: 0,
							trimEnd: 0,
							sourceDuration: duration || seg.end - seg.start,
							volume: 1,
						},
					});

					updateTask(taskId, {
						progress: `${i + 1}/${totalSegments} segments`,
					});
				}

				setProgress({
					currentSegment: totalSegments,
					totalSegments,
					currentText: "",
					phase: "done",
				});

				updateTask(taskId, {
					status: "completed",
					progress: `${totalSegments}/${totalSegments} segments`,
					completedAt: Date.now(),
				});

				toast.success(
					`Dubbing complete: ${totalSegments} segments in ${options.targetLanguage}`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Dubbing failed";
				updateTask(taskId, {
					status: "error",
					error: message,
					completedAt: Date.now(),
				});
				toast.error("Dubbing failed", { description: message });
			} finally {
				setIsDubbing(false);
				setProgress(null);
			}
		},
		[editor, segments, language, addTask, updateTask],
	);

	return { runDubbing, isDubbing, progress };
}
