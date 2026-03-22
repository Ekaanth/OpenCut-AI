"use client";

import { useCallback, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";
import { useEditor } from "@/hooks/use-editor";
import { aiClient } from "@/lib/ai-client";
import { toast } from "sonner";
import {
	POPOVER_SUBTITLE_PRESETS,
	buildPopoverSubtitleElements,
	distributeElementsToTracks,
	type PopoverSubtitlePreset,
} from "@/lib/podcast/subtitle-presets";
import { buildQuestionCardElement, QUESTION_CARD_TEMPLATES } from "@/lib/templates/question-card";
import type { ClipCandidate, QuestionCard, FaceFrame } from "@/types/ai";
import { hasMediaId } from "@/lib/timeline";
import type { TimelineElement } from "@/types/timeline";

export function PodcastClipsView() {
	const segments = useTranscriptStore((s) => s.segments);
	const editor = useEditor();
	const bgTasks = useBackgroundTasksStore();

	// Clip finder state
	const [clips, setClips] = useState<ClipCandidate[]>([]);
	const [isFindingClips, setIsFindingClips] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	// Subtitle style
	const [subtitlePreset, setSubtitlePreset] = useState<PopoverSubtitlePreset>("hormozi");

	// Feature toggles
	const [enableQuestionCards, setEnableQuestionCards] = useState(true);
	const [enableKeywordHighlight, setEnableKeywordHighlight] = useState(true);
	const [cardTemplate, setCardTemplate] = useState("overlay");
	const [cardTransparentBg, setCardTransparentBg] = useState(true);

	// Generated data
	const [questionCards, setQuestionCards] = useState<QuestionCard[]>([]);
	const [keywords, setKeywords] = useState<{ word: string; color: string }[]>([]);

	const hasTranscript = segments.length > 0;
	const [isReframing, setIsReframing] = useState(false);
	const speakerPositions = useTranscriptStore((s) => s.speakerPositions);

	// ── Auto-Reframe 16:9 → 9:16 (background task) ──
	const handleAutoReframe = useCallback(async () => {
		const taskId = `auto-reframe-${Date.now()}`;
		setIsReframing(true);

		bgTasks.addTask({
			id: taskId,
			type: "popover-subs",
			label: "Auto-reframe 9:16",
			progress: "Finding media file...",
		});

		try {
			// Find media file
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
				bgTasks.updateTask(taskId, { status: "error", error: "No video found on timeline.", completedAt: Date.now() });
				return;
			}

			const mediaAsset = editor.media.getAssets().find((a) => a.id === foundMediaId);
			if (!mediaAsset?.file) {
				bgTasks.updateTask(taskId, { status: "error", error: "Cannot access media file.", completedAt: Date.now() });
				return;
			}

			bgTasks.updateTask(taskId, { progress: "Detecting faces..." });

			let file = mediaAsset.file;
			if (!file.name?.includes(".")) {
				file = new File([file], `media.mp4`, { type: file.type || "video/mp4" });
			}

			const faceResult = await aiClient.detectFaces(file, { sampleInterval: 0.5 });

			if (faceResult.total_faces_detected === 0) {
				bgTasks.updateTask(taskId, { status: "completed", progress: "No faces detected", completedAt: Date.now() });
				return;
			}

			bgTasks.updateTask(taskId, { progress: "Applying crop transforms..." });

			// Change canvas to 9:16
			const canvasSize = editor.project.getActive().settings.canvasSize;
			const isAlreadyVertical = canvasSize.height > canvasSize.width;

			// Compute per-segment face positions based on speaker diarization
			const storeSegs = useTranscriptStore.getState().segments;
			const videoTracks = editor.timeline.getTracks().filter((t) => t.type === "video");

			for (const track of videoTracks) {
				for (const el of track.elements) {
					const videoEl = el as TimelineElement & { transform?: { scale: number; position: { x: number; y: number }; rotate: number } };
					if (!videoEl.transform) continue;

					// Find the dominant face position for this element's time range
					const elStart = el.startTime;
					const elEnd = el.startTime + el.duration;

					// Find which speaker is active during this element
					const activeSeg = storeSegs.find((seg) => seg.start < elEnd && seg.end > elStart);
					const speakerId = activeSeg?.speaker;
					const position = speakerId ? (speakerPositions[speakerId] ?? "center") : "center";

					// Find face frames within this element's time range
					const relevantFrames = faceResult.frames.filter(
						(f) => f.timestamp >= elStart && f.timestamp <= elEnd && f.faces.length > 0,
					);

					let targetX = 0.5; // center
					let targetY = 0.4; // slightly above center

					if (relevantFrames.length > 0) {
						// Average face center across relevant frames
						let sumX = 0;
						let sumY = 0;
						let count = 0;
						for (const frame of relevantFrames) {
							// Pick the face closest to the expected position
							const face = position === "left"
								? frame.faces.reduce((a, b) => (a.x < b.x ? a : b))
								: position === "right"
									? frame.faces.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b))
									: frame.faces[0];
							sumX += face.x + face.width / 2;
							sumY += face.y + face.height / 2;
							count++;
						}
						targetX = sumX / count;
						targetY = sumY / count;
					}

					if (!isAlreadyVertical) {
						// Apply crop: scale up to fill 9:16 and offset to center on face
						const scaleNeeded = canvasSize.width / (canvasSize.height * (9 / 16));
						const offsetX = (targetX - 0.5) * canvasSize.width * -scaleNeeded;
						const offsetY = (targetY - 0.5) * canvasSize.height * -0.5;

						editor.timeline.updateElements({
							updates: [{
								trackId: track.id,
								elementId: el.id,
								updates: {
									transform: {
										scale: Math.max(scaleNeeded, 1.5),
										position: { x: offsetX, y: offsetY },
										rotate: 0,
									},
								},
							}],
						});
					}
				}
			}

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `Reframed ${faceResult.total_faces_detected} faces across ${faceResult.frames.length} frames`,
				completedAt: Date.now(),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Auto-reframe failed";
			let detail = message;
			if (message.includes("404")) detail = "Face endpoint not found. Restart the AI backend.";
			else if (message.includes("503")) detail = "Face service not running. Start with: docker compose up -d face-service";
			else if (message.includes("Cannot connect")) detail = "AI backend not reachable.";
			bgTasks.updateTask(taskId, { status: "error", error: detail, completedAt: Date.now() });
		} finally {
			setIsReframing(false);
		}
	}, [editor, bgTasks, speakerPositions]);

	// ── Find Best Clips (background task) ──
	const handleFindClips = useCallback(async () => {
		if (!hasTranscript) return;

		const taskId = `clip-finder-${Date.now()}`;
		setIsFindingClips(true);

		bgTasks.addTask({
			id: taskId,
			type: "clip-finder",
			label: "Find best clips",
			progress: "Analyzing transcript with AI...",
		});

		try {
			const result = await aiClient.findClips(segments);
			setClips(result.clips);

			if (result.clips.length === 0) {
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: "No high-scoring clips found",
					completedAt: Date.now(),
				});
			} else {
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: `${result.clips.length} clips found`,
					completedAt: Date.now(),
				});
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to find clips";
			const detail = message.includes("Cannot connect") || message.includes("connection_refused")
				? "Cannot connect to AI backend. Make sure it is running with Ollama (docker compose up -d)."
				: message.includes("503")
					? "Ollama LLM is not available. Start it with: docker compose up -d ollama"
					: message;
			bgTasks.updateTask(taskId, {
				status: "error",
				error: detail,
				completedAt: Date.now(),
			});
		} finally {
			setIsFindingClips(false);
		}
	}, [segments, hasTranscript, bgTasks]);

	// ── Preview Clip (seek to time) ──
	const handlePreviewClip = useCallback(
		(clip: ClipCandidate) => {
			editor.playback.seek({ time: clip.start });
			toast.info(`Seeking to ${clip.title}`, {
				description: `${clip.start.toFixed(1)}s - ${clip.end.toFixed(1)}s`,
			});
		},
		[editor],
	);

	// ── Apply Clip (generate subtitle elements — background task) ──
	const handleApplyClip = useCallback(
		async (clip: ClipCandidate) => {
			const taskId = `apply-clip-${Date.now()}`;
			setIsApplying(true);

			bgTasks.addTask({
				id: taskId,
				type: "popover-subs",
				label: `Apply: ${clip.title}`,
				progress: "Preparing clip segments...",
			});

			try {
				// Filter segments to the clip's time range
				const clipSegments = segments
					.filter((seg) => seg.start < clip.end && seg.end > clip.start)
					.map((seg) => ({
						text: seg.text,
						start: Math.max(seg.start, clip.start),
						end: Math.min(seg.end, clip.end),
						words: seg.words
							.filter((w) => w.start >= clip.start && w.end <= clip.end)
							.map((w) => ({
								word: w.word,
								start: w.start,
								end: w.end,
								confidence: w.confidence,
							})),
					}));

				// Extract keywords if enabled
				let clipKeywords: { word: string; color: string }[] = [];
				if (enableKeywordHighlight) {
					try {
						bgTasks.updateTask(taskId, { progress: "Extracting keywords..." });
						const kwResult = await aiClient.extractKeywords(
							clipSegments.map((s, i) => ({
								id: i,
								text: s.text,
								start: s.start,
								end: s.end,
								words: s.words,
							})),
						);
						clipKeywords = kwResult.keywords;
						setKeywords(clipKeywords);
					} catch {
						// Continue without keywords
					}
				}

				// Generate question cards if enabled
				let cards: QuestionCard[] = [];
				if (enableQuestionCards) {
					try {
						bgTasks.updateTask(taskId, { progress: "Generating topic cards..." });
						const cardsResult = await aiClient.generateQuestionCards(
							clipSegments.map((s, i) => ({
								id: i,
								text: s.text,
								start: s.start,
								end: s.end,
								words: s.words,
							})),
							2,
						);
						cards = cardsResult.cards;
						setQuestionCards(cards);
					} catch {
						// Continue without cards
					}
				}

				bgTasks.updateTask(taskId, { progress: "Adding to timeline..." });
				const canvasSize = editor.project.getActive().settings.canvasSize;

				// Build card time ranges so subtitles can skip them
				const cardRanges = cards.map((c) => ({ start: c.timestamp, end: c.timestamp + 2.5 }));

				// Build popover elements (skipping card time ranges)
				const subtitleElements = buildPopoverSubtitleElements({
					segments: clipSegments,
					preset: subtitlePreset,
					canvasHeight: canvasSize.height,
					canvasWidth: canvasSize.width,
					keywords: clipKeywords,
					cardTimeRanges: cardRanges,
				});

				// Distribute across multiple tracks so overlapping words are all visible
				const trackBuckets = distributeElementsToTracks(subtitleElements);

				for (let t = 0; t < trackBuckets.length; t++) {
					const subTrackId = editor.timeline.addTrack({ type: "text", index: 0 });
					const label = trackBuckets.length === 1
						? "Popover Subs"
						: `Popover Subs ${t + 1}`;
					editor.timeline.renameTrack({ trackId: subTrackId, name: label });

					for (const el of trackBuckets[t]) {
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId: subTrackId },
							element: el,
						});
					}
				}

				// Add question card track if cards were generated
				if (cards.length > 0) {
					const cardTrackId = editor.timeline.addTrack({ type: "text", index: 0 });
					editor.timeline.renameTrack({ trackId: cardTrackId, name: "Topic Cards" });

					for (const card of cards) {
						const cardElement = buildQuestionCardElement({
							question: card.question,
							startTime: card.timestamp,
							theme: cardTemplate,
							emoji: card.emoji,
							useTransparentBackground: cardTransparentBg,
						});
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId: cardTrackId },
							element: cardElement,
						});
					}
				}

				const summary = `${subtitleElements.length} words across ${trackBuckets.length} tracks${cards.length > 0 ? `, ${cards.length} cards` : ""}`;
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: summary,
					completedAt: Date.now(),
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to apply clip";
				bgTasks.updateTask(taskId, {
					status: "error",
					error: message,
					completedAt: Date.now(),
				});
			} finally {
				setIsApplying(false);
			}
		},
		[segments, editor, subtitlePreset, enableKeywordHighlight, enableQuestionCards, cardTemplate, cardTransparentBg, bgTasks],
	);

	// ── Add Popover Subtitles (full transcript — background task) ──
	const handleAddPopoverSubs = useCallback(async () => {
		if (!hasTranscript) return;

		const taskId = `popover-subs-${Date.now()}`;
		setIsApplying(true);

		bgTasks.addTask({
			id: taskId,
			type: "popover-subs",
			label: "Popover subtitles",
			progress: "Starting...",
		});

		try {
			let kws: { word: string; color: string }[] = [];
			if (enableKeywordHighlight) {
				try {
					bgTasks.updateTask(taskId, { progress: "Extracting keywords..." });
					const kwResult = await aiClient.extractKeywords(segments);
					kws = kwResult.keywords;
					setKeywords(kws);
				} catch {
					// Continue without keywords
				}
			}

			bgTasks.updateTask(taskId, { progress: "Building popover elements..." });
			const canvasSize = editor.project.getActive().settings.canvasSize;

			const subtitleElements = buildPopoverSubtitleElements({
				segments: segments.map((s) => ({
					text: s.text,
					start: s.start,
					end: s.end,
					words: s.words,
				})),
				preset: subtitlePreset,
				canvasHeight: canvasSize.height,
				canvasWidth: canvasSize.width,
				keywords: kws,
			});

			// Distribute across multiple tracks so overlapping words are all visible
			const trackBuckets = distributeElementsToTracks(subtitleElements);

			for (let t = 0; t < trackBuckets.length; t++) {
				const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
				const label = trackBuckets.length === 1
					? "Popover Subs"
					: `Popover Subs ${t + 1}`;
				editor.timeline.renameTrack({ trackId, name: label });

				for (const el of trackBuckets[t]) {
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element: el,
					});
				}
			}

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `${subtitleElements.length} words across ${trackBuckets.length} tracks`,
				completedAt: Date.now(),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to add popover subtitles";
			bgTasks.updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
		} finally {
			setIsApplying(false);
		}
	}, [segments, editor, subtitlePreset, enableKeywordHighlight, hasTranscript, bgTasks]);

	// ── Generate Question Cards (full transcript — background task) ──
	const handleGenerateCards = useCallback(async () => {
		if (!hasTranscript) return;

		const taskId = `question-cards-${Date.now()}`;
		setIsApplying(true);

		bgTasks.addTask({
			id: taskId,
			type: "question-cards",
			label: "Question cards",
			progress: "Analyzing topic shifts...",
		});

		try {
			const result = await aiClient.generateQuestionCards(segments, 5);
			setQuestionCards(result.cards);

			if (result.cards.length === 0) {
				bgTasks.updateTask(taskId, {
					status: "completed",
					progress: "No topic shifts detected",
					completedAt: Date.now(),
				});
				return;
			}

			bgTasks.updateTask(taskId, { progress: "Adding cards to timeline..." });

			const cardTrackId = editor.timeline.addTrack({ type: "text", index: 0 });
			editor.timeline.renameTrack({ trackId: cardTrackId, name: "Topic Cards" });

			for (const card of result.cards) {
				const cardElement = buildQuestionCardElement({
					question: card.question,
					startTime: card.timestamp,
					theme: cardTemplate,
					emoji: card.emoji,
					useTransparentBackground: cardTransparentBg,
				});
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: cardTrackId },
					element: cardElement,
				});
			}

			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: `${result.cards.length} cards added`,
				completedAt: Date.now(),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to generate question cards";
			const detail = message.includes("Cannot connect") || message.includes("connection_refused")
				? "Cannot connect to AI backend. Make sure Ollama is running."
				: message.includes("503")
					? "Ollama LLM is not available. Start it with: docker compose up -d ollama"
					: message;
			bgTasks.updateTask(taskId, {
				status: "error",
				error: detail,
				completedAt: Date.now(),
			});
		} finally {
			setIsApplying(false);
		}
	}, [segments, editor, hasTranscript, cardTemplate, cardTransparentBg, bgTasks]);

	const isProcessing = isFindingClips || isApplying;

	return (
		<PanelView title="Podcast Clips">
			<div className="flex flex-col gap-4 pb-4">
				{!hasTranscript ? (
					<div className="flex flex-col gap-3">
						<p className="text-xs text-muted-foreground leading-relaxed">
							Transcribe your video first using the Transcript tab, then come back here to create podcast-style clips.
						</p>
					</div>
				) : (
					<>
						{/* ── Smart Clip Finder ── */}
						<div className="flex flex-col gap-2">
							<Label className="text-xs font-medium">Find best clips</Label>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								AI analyzes your transcript and finds the most viral-worthy moments. You can switch tabs while it runs.
							</p>
							<Button
								variant="default"
								size="sm"
								className="w-full"
								onClick={handleFindClips}
								disabled={isFindingClips}
							>
								{isFindingClips && <Spinner className="mr-1 size-3" />}
								{isFindingClips
									? "Finding clips..."
									: clips.length > 0
										? "Re-scan for clips"
										: "Find best clips"}
							</Button>
						</div>

						{/* ── Clip Candidates ── */}
						{clips.length > 0 && (
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<Label className="text-xs font-medium">Clip candidates</Label>
									<span className="text-[10px] text-muted-foreground tabular-nums">
										{clips.length} found
									</span>
								</div>
								<div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
									{clips.map((clip, idx) => (
										<div
											key={`${clip.start}-${clip.end}`}
											className="rounded-md border p-2.5 flex flex-col gap-1.5"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="flex-1 min-w-0">
													<p className="text-xs font-medium truncate">
														{idx + 1}. {clip.title}
													</p>
													<p className="text-[10px] text-muted-foreground tabular-nums">
														{formatTime(clip.start)} - {formatTime(clip.end)}
													</p>
												</div>
												<Badge
													variant={clip.score >= 80 ? "default" : "secondary"}
													className="text-[9px] px-1.5 py-0 h-4 shrink-0"
												>
													{clip.score}/100
												</Badge>
											</div>
											{clip.reason && (
												<p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
													{clip.reason}
												</p>
											)}
											{clip.tags.length > 0 && (
												<div className="flex flex-wrap gap-1">
													{clip.tags.slice(0, 3).map((tag) => (
														<Badge
															key={tag}
															variant="outline"
															className="text-[8px] px-1 py-0 h-3.5"
														>
															{tag}
														</Badge>
													))}
												</div>
											)}
											<div className="flex gap-1.5 mt-0.5">
												<Button
													variant="outline"
													size="sm"
													className="h-6 text-[10px] flex-1"
													onClick={() => handlePreviewClip(clip)}
													disabled={isProcessing}
												>
													Preview
												</Button>
												<Button
													variant="default"
													size="sm"
													className="h-6 text-[10px] flex-1"
													onClick={() => handleApplyClip(clip)}
													disabled={isProcessing}
												>
													Apply
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* ── Subtitle Style ── */}
						<div className="border-t pt-3 flex flex-col gap-2">
							<Label className="text-xs font-medium">Popover subtitle style</Label>
							<Select
								value={subtitlePreset}
								onValueChange={(v) => setSubtitlePreset(v as PopoverSubtitlePreset)}
							>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{POPOVER_SUBTITLE_PRESETS.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											<div className="flex flex-col">
												<span className="text-xs">{p.name}</span>
												<span className="text-[10px] text-muted-foreground">
													{p.description}
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={handleAddPopoverSubs}
								disabled={isProcessing}
							>
								{isApplying && <Spinner className="mr-1 size-3" />}
								Add popover subtitles
							</Button>
						</div>

						{/* ── Auto Features ── */}
						<div className="border-t pt-3 flex flex-col gap-3">
							<Label className="text-xs font-medium">Auto features</Label>

							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<span className="text-xs">Keyword highlighting</span>
									<span className="text-[10px] text-muted-foreground">
										Color-code important words via AI
									</span>
								</div>
								<Switch
									checked={enableKeywordHighlight}
									onCheckedChange={setEnableKeywordHighlight}
								/>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<span className="text-xs">Question cards</span>
									<span className="text-[10px] text-muted-foreground">
										AI topic intro slides between segments
									</span>
								</div>
								<Switch
									checked={enableQuestionCards}
									onCheckedChange={setEnableQuestionCards}
								/>
							</div>
						</div>

						{/* ── Auto-Reframe ── */}
						<div className="border-t pt-3 flex flex-col gap-2">
							<Label className="text-xs font-medium">Auto-reframe for Shorts</Label>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Detect faces and auto-crop 16:9 video to 9:16 vertical, centering on the active speaker.
							</p>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={handleAutoReframe}
								disabled={isProcessing || isReframing}
							>
								{isReframing && <Spinner className="mr-1 size-3" />}
								{isReframing ? "Reframing..." : "Auto-reframe 9:16"}
							</Button>
						</div>

						{/* ── Question Cards ── */}
						<div className="border-t pt-3 flex flex-col gap-2">
							<Label className="text-xs font-medium">Topic cards</Label>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								AI topic questions overlaid on video. Subtitles are hidden during cards.
							</p>

							<Select
								value={cardTemplate}
								onValueChange={setCardTemplate}
							>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{QUESTION_CARD_TEMPLATES.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											<div className="flex flex-col">
												<span className="text-xs">{t.name}</span>
												<span className="text-[10px] text-muted-foreground">
													{t.description}
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<span className="text-xs">Transparent background</span>
									<span className="text-[10px] text-muted-foreground">
										Show video behind card text
									</span>
								</div>
								<Switch
									checked={cardTransparentBg}
									onCheckedChange={setCardTransparentBg}
								/>
							</div>

							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={handleGenerateCards}
								disabled={isProcessing}
							>
								{isApplying && <Spinner className="mr-1 size-3" />}
								Generate question cards
							</Button>

							{questionCards.length > 0 && (
								<div className="flex flex-col gap-1 mt-1">
									{questionCards.map((card, idx) => (
										<div
											key={`${card.timestamp}-${idx}`}
											className="flex items-center gap-2 rounded-md border px-2 py-1.5"
										>
											{card.emoji && (
												<span className="text-sm shrink-0">{card.emoji}</span>
											)}
											<div className="flex-1 min-w-0">
												<p className="text-[11px] font-medium truncate">
													{card.question}
												</p>
												<p className="text-[9px] text-muted-foreground tabular-nums">
													{formatTime(card.timestamp)}
												</p>
											</div>
											<Badge
												variant="outline"
												className="text-[8px] px-1 py-0 h-3.5 shrink-0"
											>
												{card.theme}
											</Badge>
										</div>
									))}
								</div>
							)}
						</div>

						{/* ── Keywords (if extracted) ── */}
						{keywords.length > 0 && (
							<div className="border-t pt-3 flex flex-col gap-2">
								<Label className="text-xs font-medium">Detected keywords</Label>
								<div className="flex flex-wrap gap-1">
									{keywords.slice(0, 20).map((kw, idx) => (
										<Badge
											key={`${kw.word}-${idx}`}
											variant="outline"
											className="text-[10px] px-1.5 py-0 h-5"
											style={{ borderColor: kw.color, color: kw.color }}
										>
											{kw.word}
										</Badge>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</PanelView>
	);
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
