"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
} from "@hello-pangea/dnd";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiMicIcon,
	TextIcon,
	Delete02Icon,
	DragDropVerticalIcon,
	Cancel01Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import {
	computeCutsFromRemovedWords,
	computeCutsFromDeletedSegments,
	computeReorderTimeline,
	type TimeRange,
} from "@/lib/text-timeline-sync";

// ----- Types -----

export interface TranscriptWord {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	confidence: number;
	isFiller?: boolean;
}

export interface TranscriptSegment {
	id: string;
	startTime: number;
	endTime: number;
	words: TranscriptWord[];
	speaker?: string;
	chapterTitle?: string;
}

export interface SilenceRegion {
	startTime: number;
	endTime: number;
	duration: number;
}

type TranscriptionStatus = "idle" | "transcribing" | "complete" | "error";

interface TranscriptionPanelProps {
	segments: TranscriptSegment[];
	silences: SilenceRegion[];
	status: TranscriptionStatus;
	progress: number;
	currentTime: number;
	onTranscribe: () => void;
	onSeekTo: (time: number) => void;
	onWordClick?: (word: TranscriptWord) => void;
	onDeleteSegments?: (segmentIds: string[], cuts: TimeRange[]) => void;
	onCutWords?: (
		segmentId: string,
		remainingWords: TranscriptWord[],
		cuts: TimeRange[],
	) => void;
	onReorderSegments?: (
		fromIndex: number,
		toIndex: number,
		newTimings: { segmentId: number; newStart: number; newEnd: number }[],
	) => void;
	error?: string;
	className?: string;
}

// ----- Helpers -----

function formatTimestamp(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const FILLER_WORDS = new Set([
	"um", "uh", "like", "you know", "so", "basically",
	"actually", "literally", "right", "well", "er", "ah",
]);

function isFillerWord(word: TranscriptWord): boolean {
	return (
		word.isFiller ??
		FILLER_WORDS.has(word.text.toLowerCase().replace(/[.,!?]/g, ""))
	);
}

function isSegmentActive(segment: TranscriptSegment, currentTime: number): boolean {
	return currentTime >= segment.startTime && currentTime < segment.endTime;
}

/**
 * Adapt the panel's TranscriptWord to the ai.ts TranscriptionWord shape
 * so we can use text-timeline-sync functions.
 */
function toSyncWord(w: TranscriptWord) {
	return { word: w.text, start: w.startTime, end: w.endTime, confidence: w.confidence };
}

// ----- Component -----

export function TranscriptionPanel({
	segments,
	silences,
	status,
	progress,
	currentTime,
	onTranscribe,
	onSeekTo,
	onWordClick,
	onDeleteSegments,
	onCutWords,
	onReorderSegments,
	error,
	className,
}: TranscriptionPanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const lastAutoScrolledSegment = useRef<string | null>(null);

	// Auto-scroll to the active segment during playback
	const activeSegmentId = useMemo(() => {
		for (const seg of segments) {
			if (isSegmentActive(seg, currentTime)) return seg.id;
		}
		return null;
	}, [segments, currentTime]);

	useEffect(() => {
		if (!activeSegmentId || activeSegmentId === lastAutoScrolledSegment.current) return;
		lastAutoScrolledSegment.current = activeSegmentId;

		const el = segmentRefs.current.get(activeSegmentId);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [activeSegmentId]);

	// ----- Selection state -----
	const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(
		new Set(),
	);

	// ----- Strikethrough (word-level deletion) state -----
	// Map of segmentId -> Set of word ids marked for deletion
	const [markedWords, setMarkedWords] = useState<Map<string, Set<string>>>(
		new Map(),
	);

	const hasMarkedWords = useMemo(() => {
		for (const wordSet of markedWords.values()) {
			if (wordSet.size > 0) return true;
		}
		return false;
	}, [markedWords]);

	// ----- Silence helpers -----
	const findSilenceBetween = useCallback(
		(endTime: number, nextStartTime: number): SilenceRegion | undefined => {
			for (const silence of silences) {
				if (
					silence.startTime >= endTime &&
					silence.endTime <= nextStartTime &&
					silence.duration >= 0.5
				) {
					return silence;
				}
			}
			return undefined;
		},
		[silences],
	);

	// ----- Selection handlers -----
	const handleSegmentClick = useCallback(
		(segmentId: string, event: React.MouseEvent) => {
			if (event.shiftKey) {
				// Shift+click: toggle in multi-select
				setSelectedSegmentIds((prev) => {
					const next = new Set(prev);
					if (next.has(segmentId)) {
						next.delete(segmentId);
					} else {
						next.add(segmentId);
					}
					return next;
				});
			} else {
				// Plain click: single-select (or deselect if already only one selected)
				setSelectedSegmentIds((prev) => {
					if (prev.size === 1 && prev.has(segmentId)) {
						return new Set();
					}
					return new Set([segmentId]);
				});
			}
		},
		[],
	);

	// ----- Delete segment(s) -----
	const handleDeleteSegment = useCallback(
		(segmentId: string) => {
			const segment = segments.find((s) => s.id === segmentId);
			if (!segment || !onDeleteSegments) return;

			const cuts = computeCutsFromDeletedSegments([
				{
					id: Number(segmentId),
					text: segment.words.map((w) => w.text).join(" "),
					start: segment.startTime,
					end: segment.endTime,
					words: segment.words.map(toSyncWord),
				},
			]);

			onDeleteSegments([segmentId], cuts);
			setSelectedSegmentIds((prev) => {
				const next = new Set(prev);
				next.delete(segmentId);
				return next;
			});
		},
		[segments, onDeleteSegments],
	);

	const handleDeleteSelected = useCallback(() => {
		if (selectedSegmentIds.size === 0 || !onDeleteSegments) return;

		const selected = segments.filter((s) => selectedSegmentIds.has(s.id));
		const cuts = computeCutsFromDeletedSegments(
			selected.map((seg) => ({
				id: Number(seg.id),
				text: seg.words.map((w) => w.text).join(" "),
				start: seg.startTime,
				end: seg.endTime,
				words: seg.words.map(toSyncWord),
			})),
		);

		onDeleteSegments([...selectedSegmentIds], cuts);
		setSelectedSegmentIds(new Set());
	}, [selectedSegmentIds, segments, onDeleteSegments]);

	// ----- Word strikethrough toggle -----
	const toggleWordMark = useCallback((segmentId: string, wordId: string) => {
		setMarkedWords((prev) => {
			const next = new Map(prev);
			const wordSet = new Set(next.get(segmentId) ?? []);
			if (wordSet.has(wordId)) {
				wordSet.delete(wordId);
			} else {
				wordSet.add(wordId);
			}
			if (wordSet.size === 0) {
				next.delete(segmentId);
			} else {
				next.set(segmentId, wordSet);
			}
			return next;
		});
	}, []);

	// ----- Apply word cuts -----
	const handleApplyCuts = useCallback(() => {
		if (!onCutWords) return;

		for (const [segmentId, wordIds] of markedWords) {
			const segment = segments.find((s) => s.id === segmentId);
			if (!segment) continue;

			const originalWords = segment.words.map(toSyncWord);
			const remainingWords = segment.words.filter(
				(w) => !wordIds.has(w.id),
			);
			const remainingSyncWords = remainingWords.map(toSyncWord);

			const cuts = computeCutsFromRemovedWords(
				originalWords,
				remainingSyncWords,
			);

			if (cuts.length > 0) {
				onCutWords(segmentId, remainingWords, cuts);
			}
		}

		setMarkedWords(new Map());
	}, [markedWords, segments, onCutWords]);

	const handleClearMarks = useCallback(() => {
		setMarkedWords(new Map());
	}, []);

	// ----- Drag-and-drop -----
	const handleDragEnd = useCallback(
		(result: DropResult) => {
			if (!result.destination || !onReorderSegments) return;
			const fromIndex = result.source.index;
			const toIndex = result.destination.index;
			if (fromIndex === toIndex) return;

			const syncSegments = segments.map((seg) => ({
				id: Number(seg.id),
				text: seg.words.map((w) => w.text).join(" "),
				start: seg.startTime,
				end: seg.endTime,
				words: seg.words.map(toSyncWord),
			}));

			const newTimings = computeReorderTimeline(
				syncSegments,
				fromIndex,
				toIndex,
			);

			onReorderSegments(fromIndex, toIndex, newTimings);
		},
		[segments, onReorderSegments],
	);

	// ----- Render -----
	return (
		<TooltipProvider delayDuration={300}>
			<div className={cn("flex flex-col h-full bg-background", className)}>
				{/* Header */}
				<div className="flex items-center justify-between border-b px-4 py-3">
					<div className="flex items-center gap-2">
						<HugeiconsIcon
							icon={TextIcon}
							className="size-4 text-primary"
						/>
						<span className="text-sm font-medium">Transcript</span>
						{status === "complete" && segments.length > 0 && (
							<Badge variant="secondary" className="text-[10px]">
								{segments.reduce(
									(acc, s) => acc + s.words.length,
									0,
								)}{" "}
								words
							</Badge>
						)}
					</div>

					<div className="flex items-center gap-1.5">
						{/* Bulk delete button (visible when segments are selected) */}
						{selectedSegmentIds.size > 0 && onDeleteSegments && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={handleDeleteSelected}
										className="text-destructive hover:text-destructive"
									>
										<HugeiconsIcon
											icon={Delete02Icon}
											className="size-3 mr-1"
										/>
										Delete {selectedSegmentIds.size}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									Delete selected segments and cut
									corresponding timeline ranges
								</TooltipContent>
							</Tooltip>
						)}

						<Button
							variant={status === "idle" ? "default" : "outline"}
							size="sm"
							onClick={onTranscribe}
							disabled={status === "transcribing"}
						>
							{status === "transcribing" ? (
								<>
									<Spinner className="size-3 mr-1" />
									Transcribing...
								</>
							) : status === "complete" ? (
								"Re-transcribe"
							) : (
								<>
									<HugeiconsIcon
										icon={AiMicIcon}
										className="size-3 mr-1"
									/>
									Transcribe
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Progress */}
				{status === "transcribing" && (
					<div className="px-4 py-2 border-b">
						<Progress value={progress} className="h-1.5" />
						<p className="text-[11px] text-muted-foreground mt-1">
							{Math.round(progress)}% complete
						</p>
					</div>
				)}

				{/* Error */}
				{status === "error" && error && (
					<div className="px-4 py-2 border-b bg-destructive/5">
						<p className="text-xs text-destructive">{error}</p>
					</div>
				)}

				{/* Apply Cuts bar (visible when words are marked for deletion) */}
				{hasMarkedWords && (
					<div className="flex items-center justify-between px-4 py-2 border-b bg-yellow-500/5">
						<p className="text-xs text-muted-foreground">
							Words marked for removal. Apply cuts to update the
							timeline.
						</p>
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClearMarks}
							>
								<HugeiconsIcon
									icon={Cancel01Icon}
									className="size-3 mr-1"
								/>
								Clear
							</Button>
							{onCutWords && (
								<Button
									size="sm"
									onClick={handleApplyCuts}
								>
									<HugeiconsIcon
										icon={Tick02Icon}
										className="size-3 mr-1"
									/>
									Apply Cuts
								</Button>
							)}
						</div>
					</div>
				)}

				{/* Transcript content */}
				<ScrollArea ref={scrollRef} className="flex-1 px-4 py-3">
					{status === "idle" && segments.length === 0 && (
						<div className="flex flex-col items-center justify-center h-full text-center py-12">
							<HugeiconsIcon
								icon={AiMicIcon}
								className="size-10 text-muted-foreground/30 mb-3"
							/>
							<p className="text-sm text-muted-foreground">
								No transcript yet
							</p>
							<p className="text-xs text-muted-foreground/70 mt-1">
								Click &quot;Transcribe&quot; to generate a
								transcript from your video audio.
							</p>
						</div>
					)}

					{segments.length > 0 && (
						<DragDropContext onDragEnd={handleDragEnd}>
							<Droppable droppableId="transcript-segments">
								{(droppableProvided, droppableSnapshot) => (
									<div
										ref={droppableProvided.innerRef}
										{...droppableProvided.droppableProps}
										className={cn(
											"flex flex-col gap-4",
											droppableSnapshot.isDraggingOver &&
												"rounded-md bg-accent/30",
										)}
									>
										{segments.map((segment, segIndex) => {
											const nextSegment =
												segments[segIndex + 1];
											const silenceBetween = nextSegment
												? findSilenceBetween(
														segment.endTime,
														nextSegment.startTime,
													)
												: undefined;

											const isSelected =
												selectedSegmentIds.has(
													segment.id,
												);
											const segmentMarks =
												markedWords.get(segment.id);

											const isActiveSegment = isSegmentActive(segment, currentTime);

											return (
												<Draggable
													key={segment.id}
													draggableId={segment.id}
													index={segIndex}
												>
													{(
														draggableProvided,
														draggableSnapshot,
													) => (
														<div
															ref={(node) => {
																draggableProvided.innerRef(node);
																if (node) {
																	segmentRefs.current.set(segment.id, node);
																} else {
																	segmentRefs.current.delete(segment.id);
																}
															}}
															{...draggableProvided.draggableProps}
														>
															{/* Chapter divider */}
															{segment.chapterTitle && (
																<div className="flex items-center gap-2 mb-2 mt-1">
																	<div className="h-px flex-1 bg-border" />
																	<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
																		{
																			segment.chapterTitle
																		}
																	</span>
																	<div className="h-px flex-1 bg-border" />
																</div>
															)}

															{/* Segment */}
															<div
																role="button"
																tabIndex={0}
																onClick={(e) =>
																	handleSegmentClick(
																		segment.id,
																		e,
																	)
																}
																onKeyDown={(
																	e,
																) => {
																	if (
																		e.key ===
																			"Enter" ||
																		e.key ===
																			" "
																	) {
																		e.preventDefault();
																		handleSegmentClick(
																			segment.id,
																			e as unknown as React.MouseEvent,
																		);
																	}
																}}
																className={cn(
																	"group relative flex gap-2 rounded-md p-2 -mx-2 transition-colors",
																	isActiveSegment &&
																		!isSelected &&
																		"bg-primary/5 ring-1 ring-primary/20",
																	isSelected &&
																		"bg-primary/10 ring-1 ring-primary/30",
																	!isSelected &&
																		!isActiveSegment &&
																		"hover:bg-accent/50",
																	draggableSnapshot.isDragging &&
																		"bg-accent shadow-lg ring-1 ring-border",
																)}
															>
																{/* Drag handle */}
																<div
																	{...draggableProvided.dragHandleProps}
																	className="flex items-start pt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
																	onClick={(
																		e,
																	) =>
																		e.stopPropagation()
																	}
																>
																	<HugeiconsIcon
																		icon={
																			DragDropVerticalIcon
																		}
																		className="size-4 text-muted-foreground"
																	/>
																</div>

																{/* Content */}
																<div className="flex-1 min-w-0">
																	{/* Speaker + timestamp */}
																	<div className="flex items-center gap-2 mb-1">
																		{segment.speaker && (
																			<span className="text-[11px] font-medium text-primary">
																				{
																					segment.speaker
																				}
																			</span>
																		)}
																		<button
																			type="button"
																			onClick={(
																				e,
																			) => {
																				e.stopPropagation();
																				onSeekTo(
																					segment.startTime,
																				);
																			}}
																			className="text-[10px] text-muted-foreground hover:text-foreground transition-colors tabular-nums"
																		>
																			{formatTimestamp(
																				segment.startTime,
																			)}
																		</button>
																	</div>

																	{/* Words */}
																	<p className="text-sm leading-relaxed">
																		{segment.words.map(
																			(
																				word,
																			) => {
																				const isActive =
																					currentTime >=
																						word.startTime &&
																					currentTime <
																						word.endTime;
																				const isFiller =
																					isFillerWord(word);
																				const isMarked =
																					segmentMarks?.has(
																						word.id,
																					) ??
																					false;

																				return (
																					<ContextMenu
																						key={
																							word.id
																						}
																					>
																						<ContextMenuTrigger
																							asChild
																						>
																							<span
																								role="button"
																								tabIndex={
																									0
																								}
																								onClick={(
																									e,
																								) => {
																									e.stopPropagation();
																									onSeekTo(
																										word.startTime,
																									);
																									onWordClick?.(
																										word,
																									);
																								}}
																								onKeyDown={(
																									e,
																								) => {
																									if (
																										e.key ===
																											"Enter" ||
																										e.key ===
																											" "
																									) {
																										e.preventDefault();
																										onSeekTo(
																											word.startTime,
																										);
																										onWordClick?.(
																											word,
																										);
																									}
																								}}
																								className={cn(
																									"cursor-pointer rounded-sm px-0.5 py-px transition-colors hover:bg-accent",
																									isActive &&
																										"bg-primary/25 text-primary font-semibold rounded",
																									isFiller &&
																										!isActive &&
																										!isMarked &&
																										"underline decoration-dotted decoration-yellow-500/60 underline-offset-2",
																									isMarked &&
																										"line-through opacity-40 bg-destructive/10",
																								)}
																							>
																								{
																									word.text
																								}{" "}
																							</span>
																						</ContextMenuTrigger>
																						<ContextMenuContent>
																							<ContextMenuItem
																								onClick={() =>
																									toggleWordMark(
																										segment.id,
																										word.id,
																									)
																								}
																							>
																								{isMarked
																									? "Unmark word"
																									: "Mark for removal"}
																							</ContextMenuItem>
																							<ContextMenuSeparator />
																							<ContextMenuItem
																								onClick={() =>
																									onSeekTo(
																										word.startTime,
																									)
																								}
																							>
																								Seek
																								to{" "}
																								{formatTimestamp(
																									word.startTime,
																								)}
																							</ContextMenuItem>
																						</ContextMenuContent>
																					</ContextMenu>
																				);
																			},
																		)}
																	</p>
																</div>

																{/* Delete button */}
																{onDeleteSegments && (
																	<Tooltip>
																		<TooltipTrigger
																			asChild
																		>
																			<button
																				type="button"
																				onClick={(
																					e,
																				) => {
																					e.stopPropagation();
																					handleDeleteSegment(
																						segment.id,
																					);
																				}}
																				className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
																			>
																				<HugeiconsIcon
																					icon={
																						Cancel01Icon
																					}
																					className="size-3.5"
																				/>
																			</button>
																		</TooltipTrigger>
																		<TooltipContent>
																			Delete
																			segment
																			and
																			cut
																			from
																			timeline
																		</TooltipContent>
																	</Tooltip>
																)}
															</div>

															{/* Silence marker */}
															{silenceBetween && (
																<div className="flex items-center gap-2 my-2 mx-2">
																	<div className="h-px flex-1 bg-border border-dashed" />
																	<button
																		type="button"
																		onClick={() =>
																			onSeekTo(
																				silenceBetween.startTime,
																			)
																		}
																		className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors font-mono"
																	>
																		[silence:{" "}
																		{silenceBetween.duration.toFixed(
																			1,
																		)}
																		s]
																	</button>
																	<div className="h-px flex-1 bg-border border-dashed" />
																</div>
															)}
														</div>
													)}
												</Draggable>
											);
										})}
										{droppableProvided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>
					)}
				</ScrollArea>
			</div>
		</TooltipProvider>
	);
}
