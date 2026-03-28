"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
	ArrowDown01Icon,
	Tick01Icon,
	Clock01Icon,
	MusicNote03Icon,
	Mic01Icon,
	ViewIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { aiClient } from "@/lib/ai-client";
import { getApiKey, getFreesoundHeaders } from "@/lib/api-keys";
import { useEditor } from "@/hooks/use-editor";
import { buildLibraryAudioElement, buildTextElement } from "@/lib/timeline/element-utils";
import type { ReelTemplate, ReelTemplateSegment } from "@/types/ai";
import type { SoundEffect } from "@/types/sounds";
import { toast } from "sonner";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";

const STYLE_OPTIONS = [
	{ value: "engaging", label: "Engaging" },
	{ value: "cinematic", label: "Cinematic" },
	{ value: "educational", label: "Educational" },
	{ value: "funny", label: "Funny" },
];

const DURATION_OPTIONS = [
	{ value: 10, label: "10s" },
	{ value: 15, label: "15s" },
	{ value: 30, label: "30s" },
	{ value: 60, label: "60s" },
];

const STORAGE_KEY = "opencut-template-job";
const RESULT_STORAGE_KEY = "opencut-template-result";
const POLL_INTERVAL = 2500;

async function searchFreesound(query: string, pageSize = 5): Promise<SoundEffect[]> {
	try {
		const params = new URLSearchParams({
			q: query,
			page_size: String(pageSize),
			sort: "rating",
			min_rating: "3",
		});
		const res = await fetch(`/api/sounds/search?${params}`, {
			headers: getFreesoundHeaders(),
		});
		if (!res.ok) return [];
		const data = await res.json();
		return data.results ?? [];
	} catch {
		return [];
	}
}

function saveJobToStorage(jobId: string, topic: string, style: string) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, topic, style, ts: Date.now() }));
	} catch {}
}

function loadJobFromStorage(): { jobId: string; topic: string; style: string } | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		// Expire after 10 minutes
		if (Date.now() - (data.ts ?? 0) > 10 * 60 * 1000) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return data;
	} catch {
		return null;
	}
}

function clearJobStorage() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {}
}

function saveTemplateResult(result: ReelTemplate) {
	try {
		localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify({ result, ts: Date.now() }));
	} catch {}
}

function loadTemplateResult(): ReelTemplate | null {
	try {
		const raw = localStorage.getItem(RESULT_STORAGE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		// Expire after 1 hour
		if (Date.now() - (data.ts ?? 0) > 60 * 60 * 1000) {
			localStorage.removeItem(RESULT_STORAGE_KEY);
			return null;
		}
		return data.result;
	} catch {
		return null;
	}
}

function clearTemplateResult() {
	try {
		localStorage.removeItem(RESULT_STORAGE_KEY);
	} catch {}
}

interface TemplatePanelProps {
	className?: string;
}

export function TemplatePanel({ className }: TemplatePanelProps) {
	const editor = useEditor();
	const [topic, setTopic] = useState("");
	const [duration, setDuration] = useState(15);
	const [style, setStyle] = useState("engaging");
	const [isGenerating, setIsGenerating] = useState(false);
	const [template, setTemplateRaw] = useState<ReelTemplate | null>(null);
	const setTemplate = useCallback((t: ReelTemplate | null) => {
		setTemplateRaw(t);
		if (t) {
			saveTemplateResult(t);
		} else {
			clearTemplateResult();
		}
	}, []);
	const [error, setError] = useState<string | null>(null);
	const [imported, setImported] = useState(false);
	const [isLoadingAudio, setIsLoadingAudio] = useState(false);
	const [audioStatus, setAudioStatus] = useState<string | null>(null);
	const [jobId, setJobId] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const bgTaskIdRef = useRef<string | null>(null);
	const addBgTask = useBackgroundTasksStore((s) => s.addTask);
	const updateBgTask = useBackgroundTasksStore((s) => s.updateTask);

	// ── Restore completed template result on mount ──
	useEffect(() => {
		const savedResult = loadTemplateResult();
		if (savedResult) {
			setTemplateRaw(savedResult);
		}
	}, []);

	// ── Resume a pending job on mount ──
	useEffect(() => {
		const saved = loadJobFromStorage();
		if (!saved || saved.jobId === "__direct__") {
			clearJobStorage();
			return;
		}

		setJobId(saved.jobId);
		setTopic(saved.topic);
		setStyle(saved.style);
		setIsGenerating(true);

		// Register in background tasks widget so it's visible
		const taskId = `template-resume-${Date.now()}`;
		bgTaskIdRef.current = taskId;
		const { addTask: addResumeTask, updateTask: updateResumeTask } = useBackgroundTasksStore.getState();
		addResumeTask({
			id: taskId,
			type: "template-generation",
			label: `Template: ${saved.topic.slice(0, 40)}`,
			progress: "Generating in background...",
		});

		// Start polling immediately
		let cancelled = false;
		const poll = async () => {
			try {
				const job = await aiClient.getTemplateJob(saved.jobId);
				if (cancelled) return;

				if (job.status === "completed" && job.result) {
					setTemplate(job.result);
					setIsGenerating(false);
					clearJobStorage();
					updateResumeTask(taskId, {
						status: "completed",
						progress: job.result.title || "Done",
						completedAt: Date.now(),
					});
				} else if (job.status === "failed") {
					setError(job.error ?? "Template generation failed");
					setIsGenerating(false);
					clearJobStorage();
					updateResumeTask(taskId, {
						status: "error",
						error: job.error || "Try again with a different topic.",
						completedAt: Date.now(),
					});
				}
				// else still running — keep polling
			} catch {
				// Backend not reachable — keep trying
			}
		};

		poll(); // Check once immediately
		const interval = setInterval(poll, POLL_INTERVAL);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []); // Only on mount

	// ── Clean up poll on unmount ──
	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	const startPolling = useCallback((jid: string) => {
		if (pollRef.current) clearInterval(pollRef.current);

		pollRef.current = setInterval(async () => {
			try {
				const job = await aiClient.getTemplateJob(jid);

				if (job.status === "completed" && job.result) {
					setTemplate(job.result);
					setIsGenerating(false);
					clearJobStorage();
					if (pollRef.current) clearInterval(pollRef.current);
					if (bgTaskIdRef.current) {
						updateBgTask(bgTaskIdRef.current, {
							status: "completed",
							progress: job.result.title || "Done",
							completedAt: Date.now(),
						});
					}
				} else if (job.status === "failed") {
					setError(job.error ?? "Template generation failed");
					setIsGenerating(false);
					clearJobStorage();
					if (pollRef.current) clearInterval(pollRef.current);
					if (bgTaskIdRef.current) {
						updateBgTask(bgTaskIdRef.current, {
							status: "error",
							error: job.error || "Try again with a different topic.",
							completedAt: Date.now(),
						});
					}
				}
			} catch {
				// Backend temporarily unreachable — keep polling
			}
		}, POLL_INTERVAL);
	}, [updateBgTask]);

	const handleGenerate = useCallback(async () => {
		const trimmed = topic.trim();
		if (!trimmed || isGenerating) return;

		setIsGenerating(true);
		setError(null);
		setTemplate(null);
		setImported(false);
		setAudioStatus(null);

		// Register in the background tasks widget
		const taskId = `template-${Date.now()}`;
		bgTaskIdRef.current = taskId;
		addBgTask({
			id: taskId,
			type: "template-generation",
			label: `Template: ${trimmed.slice(0, 40)}${trimmed.length > 40 ? "..." : ""}`,
			progress: "Starting generation...",
		});

		try {
			const response = await aiClient.startTemplateJob(trimmed, duration, style);

			// Direct result (old backend or instant response)
			if (response.status === "completed" && response.result) {
				setTemplate(response.result);
				setIsGenerating(false);
				updateBgTask(taskId, {
					status: "completed",
					progress: response.result.title || "Done",
					completedAt: Date.now(),
				});
				return;
			}

			// Job-based (new backend) — poll for result
			setJobId(response.job_id);
			saveJobToStorage(response.job_id, trimmed, style);
			startPolling(response.job_id);
			updateBgTask(taskId, { progress: "Generating in background..." });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start template generation");
			setIsGenerating(false);
			updateBgTask(taskId, {
				status: "error",
				error: err instanceof Error ? err.message : "Generation failed",
				completedAt: Date.now(),
			});
		}
	}, [topic, duration, style, isGenerating, startPolling]);

	const handleImport = useCallback(async () => {
		if (!template || imported) return;

		// ── Step 1: Add guide segments to the timeline ──
		const supportsTransaction = typeof editor.command.beginTransaction === "function";
		if (supportsTransaction) editor.command.beginTransaction();

		try {
			for (const segment of template.segments) {
				const guideElement = buildTextElement({
					startTime: segment.start_time,
					raw: {
						name: `${segment.order}. ${segment.title}`,
						content: segment.key_message || segment.title,
						duration: segment.duration,
						fontSize: 1,
						fontFamily: "Arial",
						fontWeight: "normal",
						color: "transparent",
						textAlign: "center",
						hidden: true,
						opacity: 0,
						background: {
							enabled: false,
							color: "transparent",
						},
						transform: {
							scale: 1,
							position: { x: 0, y: 0 },
							rotate: 0,
						},
					},
				});

				editor.timeline.insertElement({
					element: guideElement,
					placement: { mode: "auto", trackType: "text" },
				});
			}

			if (supportsTransaction) editor.command.commitTransaction();
		} catch {
			if (supportsTransaction) editor.command.rollbackTransaction();
		}

		// ── Step 2: Try loading background audio (graceful) ──
		setIsLoadingAudio(true);
		setAudioStatus("Searching for background audio...");

		try {
			// Check if Freesound API key is configured
			const hasFreesoundKey = !!(
				getApiKey("FREESOUND_API_KEY") ||
				process.env.FREESOUND_API_KEY
			);

			if (!hasFreesoundKey) {
				setAudioStatus("Add a Freesound API key in Settings to auto-import background audio.");
				setIsLoadingAudio(false);
				setImported(true);
				return;
			}

			const query = template.background_audio?.query ?? `${style} ambient background`;
			let sounds = await searchFreesound(query, 5);

			if (sounds.length === 0) {
				const fallbackQuery = template.background_audio?.tags?.[0] ?? style;
				sounds = await searchFreesound(fallbackQuery, 5);
			}

			if (sounds.length === 0) {
				setAudioStatus("No matching audio found. Browse the Sounds tab to add background audio.");
				setIsLoadingAudio(false);
				setImported(true);
				return;
			}

			setAudioStatus("Loading audio to timeline...");

			const targetDuration = template.total_duration;
			const sorted = [...sounds].sort((a, b) => {
				const aDiff = Math.abs(a.duration - targetDuration);
				const bDiff = Math.abs(b.duration - targetDuration);
				if (Math.abs(aDiff - bDiff) < 3) return (b.rating ?? 0) - (a.rating ?? 0);
				return aDiff - bDiff;
			});

			const bestSound = sorted[0];
			const audioUrl = bestSound.previewUrl;

			if (!audioUrl) {
				setAudioStatus("Browse the Sounds tab to add background audio.");
				setIsLoadingAudio(false);
				setImported(true);
				return;
			}

			const response = await fetch(audioUrl);
			if (!response.ok) {
				setAudioStatus("Browse the Sounds tab to add background audio.");
				setIsLoadingAudio(false);
				setImported(true);
				return;
			}

			const arrayBuffer = await response.arrayBuffer();
			const audioContext = new AudioContext();
			const buffer = await audioContext.decodeAudioData(arrayBuffer);

			const tracks = editor.timeline.getTracks();
			const audioTrack = tracks.find((t) => t.type === "audio");
			const trackId = audioTrack
				? audioTrack.id
				: editor.timeline.addTrack({ type: "audio" });

			const element = buildLibraryAudioElement({
				sourceUrl: audioUrl,
				name: `BG: ${bestSound.name}`,
				duration: bestSound.duration,
				startTime: 0,
				buffer,
			});

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});

			setAudioStatus(`Added: ${bestSound.name}`);
		} catch {
			setAudioStatus("Browse the Sounds tab to add background audio.");
		} finally {
			setIsLoadingAudio(false);
			setImported(true);
		}
	}, [template, imported, editor, style]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleGenerate();
			}
		},
		[handleGenerate],
	);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Input Section */}
			<div className="px-4 py-3 border-b space-y-3">
				<div>
					<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
						Topic
					</label>
					<Input
						value={topic}
						onChange={(e) => setTopic(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder='e.g. "5 tips for productivity"'
						disabled={isGenerating}
						className="text-sm"
					/>
				</div>

				<div className="flex gap-2">
					<div className="flex-1">
						<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
							Duration
						</label>
						<div className="flex gap-1">
							{DURATION_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setDuration(opt.value)}
									disabled={isGenerating}
									className={cn(
										"flex-1 text-xs py-1.5 rounded-md border transition-colors",
										duration === opt.value
											? "bg-primary text-primary-foreground border-primary"
											: "bg-background hover:bg-accent border-border",
									)}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<div>
					<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
						Style
					</label>
					<div className="flex gap-1">
						{STYLE_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								onClick={() => setStyle(opt.value)}
								disabled={isGenerating}
								className={cn(
									"flex-1 text-xs py-1.5 rounded-md border transition-colors",
									style === opt.value
										? "bg-primary text-primary-foreground border-primary"
										: "bg-background hover:bg-accent border-border",
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				<Button
					onClick={handleGenerate}
					disabled={!topic.trim() || isGenerating}
					className="w-full"
					size="sm"
				>
					{isGenerating ? (
						<>
							<Spinner className="size-3.5 mr-2" />
							Generating in background...
						</>
					) : (
						"Generate Template"
					)}
				</Button>

				{isGenerating && (
					<p className="text-[10px] text-muted-foreground text-center">
						You can switch tabs — the template generates in the background.
					</p>
				)}
			</div>

			{/* Results */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3">
					{error && (
						<div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
							{error}
						</div>
					)}

					{!template && !isGenerating && !error && (
						<div className="text-center py-8">
							<HugeiconsIcon
								icon={SparklesIcon}
								className="size-8 text-muted-foreground/40 mx-auto mb-2"
							/>
							<p className="text-sm text-muted-foreground">
								Generate a content guide for your reel
							</p>
							<p className="text-xs text-muted-foreground/60 mt-1">
								AI creates a production blueprint with voiceover scripts,
								visual directions, and background audio
							</p>
						</div>
					)}

					{isGenerating && !template && (
						<div className="text-center py-8">
							<Spinner className="size-6 mx-auto mb-2" />
							<p className="text-sm text-muted-foreground">
								Creating your content guide...
							</p>
							<p className="text-[10px] text-muted-foreground/60 mt-1">
								Running in the background — feel free to switch tabs
							</p>
						</div>
					)}

					{template && (
						<div className="space-y-3">
							{/* Template header */}
							<div className="flex items-start justify-between gap-2">
								<div>
									<h3 className="text-sm font-medium">{template.title}</h3>
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="secondary" className="text-[10px]">
											{template.total_duration}s
										</Badge>
										<Badge variant="outline" className="text-[10px]">
											{template.style}
										</Badge>
										<Badge variant="outline" className="text-[10px]">
											{template.segments.length} segments
										</Badge>
									</div>
								</div>
							</div>

							{/* Audio info */}
							{template.background_audio && (
								<div className="rounded-lg border bg-primary/5 px-3 py-2 flex items-center gap-2">
									<HugeiconsIcon
										icon={MusicNote03Icon}
										className="size-3.5 text-primary shrink-0"
									/>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-medium text-primary">
											Background Audio
										</p>
										<p className="text-[10px] text-muted-foreground truncate">
											{template.background_audio.mood}
										</p>
									</div>
								</div>
							)}

							{/* Segments — content guide */}
							<div>
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
									Content Guide
								</p>
								<div className="space-y-2">
									{template.segments.map((segment) => (
										<SegmentCard key={segment.order} segment={segment} />
									))}
								</div>
							</div>

							{/* Import button */}
							<Button
								onClick={handleImport}
								disabled={imported || isLoadingAudio}
								className="w-full"
								variant={imported ? "outline" : "default"}
								size="sm"
							>
								{isLoadingAudio ? (
									<>
										<Spinner className="size-3.5 mr-2" />
										Adding to timeline...
									</>
								) : imported ? (
									<>
										<HugeiconsIcon icon={Tick01Icon} className="size-3.5 mr-2" />
										Added to Timeline
									</>
								) : (
									<>
										<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 mr-2" />
										Add to Timeline
									</>
								)}
							</Button>

							{audioStatus && (
								<div className={cn(
									"rounded-lg border px-3 py-2 text-[10px]",
									audioStatus.startsWith("Added:")
										? "border-green-500/30 bg-green-500/5 text-green-400"
										: "border-muted bg-muted/30 text-muted-foreground",
								)}>
									{audioStatus.startsWith("Added:") && (
										<HugeiconsIcon
											icon={MusicNote03Icon}
											className="size-3 inline mr-1"
										/>
									)}
									{audioStatus}
								</div>
							)}

							{imported && (
								<p className="text-[10px] text-muted-foreground text-center">
									Guide segments added to the timeline. They are hidden from the
									video — use them as markers for what content goes where.
									Record voiceover following the scripts above.
								</p>
							)}
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

function SegmentCard({ segment }: { segment: ReelTemplateSegment }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div
			className="rounded-lg border bg-card overflow-hidden cursor-pointer"
			onClick={() => setExpanded(!expanded)}
		>
			<div className="px-3 py-2 flex items-center gap-2">
				<div className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary shrink-0">
					<span className="text-[10px] font-bold">{segment.order}</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-xs font-medium truncate">{segment.title}</p>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					<HugeiconsIcon icon={Clock01Icon} className="size-3 text-muted-foreground" />
					<span className="text-[10px] text-muted-foreground">
						{segment.start_time}s – {segment.end_time}s
					</span>
				</div>
			</div>

			{expanded && (
				<div className="px-3 pb-2.5 space-y-2 border-t pt-2">
					<div>
						<div className="flex items-center gap-1 mb-0.5">
							<HugeiconsIcon icon={SparklesIcon} className="size-3 text-primary" />
							<p className="text-[10px] font-medium text-primary uppercase tracking-wider">
								Key Message
							</p>
						</div>
						<p className="text-xs font-semibold">{segment.key_message}</p>
					</div>
					<div>
						<div className="flex items-center gap-1 mb-0.5">
							<HugeiconsIcon icon={Mic01Icon} className="size-3 text-muted-foreground" />
							<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
								Voiceover Script
							</p>
						</div>
						<p className="text-xs text-muted-foreground">{segment.narration}</p>
					</div>
					<div>
						<div className="flex items-center gap-1 mb-0.5">
							<HugeiconsIcon icon={ViewIcon} className="size-3 text-muted-foreground" />
							<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
								Visual Direction
							</p>
						</div>
						<p className="text-xs text-muted-foreground italic">
							{segment.visual_description}
						</p>
					</div>
					{segment.audio_mood && (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={MusicNote03Icon} className="size-3 text-muted-foreground" />
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
									Audio Mood
								</p>
							</div>
							<p className="text-xs text-muted-foreground">{segment.audio_mood}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
