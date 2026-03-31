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
import { useAIStore } from "@/stores/ai-store";

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

const LANGUAGE_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "pt", label: "Portuguese" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" },
	{ value: "zh", label: "Chinese" },
	{ value: "hi", label: "Hindi" },
	{ value: "ar", label: "Arabic" },
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

interface StoredTemplate {
	id: string;
	result: ReelTemplate;
	ts: number;
	imported: boolean;
}

const MAX_STORED_TEMPLATES = 20;

function saveTemplateToHistory(result: ReelTemplate): string {
	const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	try {
		const history = loadTemplateHistory();
		history.unshift({ id, result, ts: Date.now(), imported: false });
		// Keep only the most recent
		if (history.length > MAX_STORED_TEMPLATES) history.length = MAX_STORED_TEMPLATES;
		localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(history));
	} catch {}
	return id;
}

function loadTemplateHistory(): StoredTemplate[] {
	try {
		const raw = localStorage.getItem(RESULT_STORAGE_KEY);
		if (!raw) return [];
		const data = JSON.parse(raw);
		// Migrate from old single-template format
		if (data && !Array.isArray(data) && data.result) {
			const migrated: StoredTemplate[] = [{
				id: `tpl-migrated`,
				result: data.result,
				ts: data.ts ?? Date.now(),
				imported: false,
			}];
			localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(migrated));
			return migrated;
		}
		if (!Array.isArray(data)) return [];
		return data;
	} catch {
		return [];
	}
}

function markTemplateImported(id: string) {
	try {
		const history = loadTemplateHistory();
		const entry = history.find((t) => t.id === id);
		if (entry) entry.imported = true;
		localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(history));
	} catch {}
}

function removeTemplateFromHistory(id: string) {
	try {
		const history = loadTemplateHistory().filter((t) => t.id !== id);
		localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(history));
	} catch {}
}

function clearTemplateHistory() {
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
	const [language, setLanguage] = useState("en");
	const [isGenerating, setIsGenerating] = useState(false);
	const [templateHistory, setTemplateHistory] = useState<StoredTemplate[]>([]);
	const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoadingAudio, setIsLoadingAudio] = useState(false);
	const [audioStatus, setAudioStatus] = useState<string | null>(null);
	const [jobId, setJobId] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const bgTaskIdRef = useRef<string | null>(null);
	const addBgTask = useBackgroundTasksStore((s) => s.addTask);
	const updateBgTask = useBackgroundTasksStore((s) => s.updateTask);
	const saveIdea = useAIStore((s) => s.saveIdea);

	// ── Restore template history on mount ──
	useEffect(() => {
		setTemplateHistory(loadTemplateHistory());
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
		let intervalHandle: ReturnType<typeof setInterval> | null = null;
		const poll = async () => {
			try {
				const job = await aiClient.getTemplateJob(saved.jobId);
				if (cancelled) return;

				if (job.status === "completed" && job.result) {
					if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
					const newId = saveTemplateToHistory(job.result);
					setTemplateHistory(loadTemplateHistory());
					setActiveTemplateId(newId);
					setIsGenerating(false);
					clearJobStorage();
					updateResumeTask(taskId, {
						status: "completed",
						progress: job.result.title || "Done",
						completedAt: Date.now(),
					});
				} else if (job.status === "failed") {
					if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
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
		intervalHandle = setInterval(poll, POLL_INTERVAL);

		return () => {
			cancelled = true;
			if (intervalHandle) clearInterval(intervalHandle);
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

		// Capture the current bg task ID so it doesn't get lost if the user generates another template
		const capturedBgTaskId = bgTaskIdRef.current;

		pollRef.current = setInterval(async () => {
			try {
				const job = await aiClient.getTemplateJob(jid);

				if (job.status === "completed" && job.result) {
					if (pollRef.current) {
						clearInterval(pollRef.current);
						pollRef.current = null;
					}
					const newId2 = saveTemplateToHistory(job.result);
					setTemplateHistory(loadTemplateHistory());
					setActiveTemplateId(newId2);
					setIsGenerating(false);
					clearJobStorage();
					if (capturedBgTaskId) {
						useBackgroundTasksStore.getState().updateTask(capturedBgTaskId, {
							status: "completed",
							progress: job.result.title || "Done",
							completedAt: Date.now(),
						});
					}
				} else if (job.status === "failed") {
					if (pollRef.current) {
						clearInterval(pollRef.current);
						pollRef.current = null;
					}
					setError(job.error ?? "Template generation failed");
					setIsGenerating(false);
					clearJobStorage();
					if (capturedBgTaskId) {
						useBackgroundTasksStore.getState().updateTask(capturedBgTaskId, {
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
	}, []);

	const handleGenerate = useCallback(async () => {
		const trimmed = topic.trim();
		if (!trimmed || isGenerating) return;

		setIsGenerating(true);
		setError(null);
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
			const response = await aiClient.startTemplateJob(trimmed, duration, style, language);

			// Direct result (old backend or instant response)
			if (response.status === "completed" && response.result) {
				const directId = saveTemplateToHistory(response.result);
				setTemplateHistory(loadTemplateHistory());
				setActiveTemplateId(directId);
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
	}, [topic, duration, style, language, isGenerating, startPolling]);

	const handleImport = useCallback(async (templateToImport: ReelTemplate, storedId: string) => {

		// ── Step 1: Add guide segments to the timeline ──
		const supportsTransaction = typeof editor.command.beginTransaction === "function";
		if (supportsTransaction) editor.command.beginTransaction();

		try {
			for (const segment of templateToImport.segments) {
				// Build structured content with all segment info for AI generation
				const contentParts: string[] = [];
				if (segment.title) contentParts.push(`[${segment.title}]`);
				if (segment.visual_description) contentParts.push(`Visual: ${segment.visual_description}`);
				if (segment.narration) contentParts.push(`Narration: ${segment.narration}`);
				if (segment.key_message) contentParts.push(`Key: ${segment.key_message}`);
				if (segment.audio_mood) contentParts.push(`Mood: ${segment.audio_mood}`);
				const segmentContent = contentParts.join("\n") || segment.title;

				const guideElement = buildTextElement({
					startTime: segment.start_time,
					raw: {
						name: `${segment.order}. ${segment.title}`,
						content: segmentContent,
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
				markTemplateImported(storedId);
			setTemplateHistory(loadTemplateHistory());
				return;
			}

			const query = templateToImport.background_audio?.query ?? `${style} ambient background`;
			let sounds = await searchFreesound(query, 5);

			if (sounds.length === 0) {
				const fallbackQuery = templateToImport.background_audio?.tags?.[0] ?? style;
				sounds = await searchFreesound(fallbackQuery, 5);
			}

			if (sounds.length === 0) {
				setAudioStatus("No matching audio found. Browse the Sounds tab to add background audio.");
				setIsLoadingAudio(false);
				markTemplateImported(storedId);
			setTemplateHistory(loadTemplateHistory());
				return;
			}

			setAudioStatus("Loading audio to timeline...");

			const targetDuration = templateToImport.total_duration;
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
				markTemplateImported(storedId);
			setTemplateHistory(loadTemplateHistory());
				return;
			}

			const response = await fetch(audioUrl);
			if (!response.ok) {
				setAudioStatus("Browse the Sounds tab to add background audio.");
				setIsLoadingAudio(false);
				markTemplateImported(storedId);
			setTemplateHistory(loadTemplateHistory());
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

			// Trim audio to match template duration (don't play beyond the video)
			const sourceDuration = bestSound.duration;
			const clampedDuration = Math.min(sourceDuration, templateToImport.total_duration);
			const trimEnd = sourceDuration > clampedDuration
				? sourceDuration - clampedDuration
				: 0;

			const element = buildLibraryAudioElement({
				sourceUrl: audioUrl,
				name: `BG: ${bestSound.name}`,
				duration: clampedDuration,
				startTime: 0,
				buffer,
			});
			// Override trimEnd and sourceDuration to properly trim the audio
			(element as Record<string, unknown>).trimEnd = trimEnd;
			(element as Record<string, unknown>).sourceDuration = sourceDuration;

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});

			setAudioStatus(`Added: ${bestSound.name}`);
		} catch {
			setAudioStatus("Browse the Sounds tab to add background audio.");
		} finally {
			setIsLoadingAudio(false);
			markTemplateImported(storedId);
			setTemplateHistory(loadTemplateHistory());
		}
	}, [editor, style]);

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

				<div>
					<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
						Language
					</label>
					<div className="flex flex-wrap gap-1">
						{LANGUAGE_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								onClick={() => setLanguage(opt.value)}
								disabled={isGenerating}
								className={cn(
									"text-xs py-1 px-2 rounded-md border transition-colors",
									language === opt.value
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

					{templateHistory.length === 0 && !isGenerating && !error && (
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

					{isGenerating && (
						<div className="text-center py-6 mb-2">
							<Spinner className="size-5 mx-auto mb-2" />
							<p className="text-xs text-muted-foreground">
								Creating content guide...
							</p>
						</div>
					)}

					{/* Template history — newest first, each collapsible */}
					<div className="space-y-2">
						{templateHistory.map((stored) => {
							const isActive = activeTemplateId === stored.id;
							return (
								<TemplateHistoryCard
									key={stored.id}
									stored={stored}
									isExpanded={isActive}
									onToggle={() => setActiveTemplateId(isActive ? null : stored.id)}
									onImport={() => handleImport(stored.result, stored.id)}
									onSaveToIdeas={() => {
										const summary = `Template: ${stored.result.title}\n${stored.result.segments.map((s) => `${s.order}. ${s.title}: ${s.key_message}`).join("\n")}`;
										saveIdea(summary);
										toast.success("Saved to Ideas");
									}}
									onRemove={() => {
										removeTemplateFromHistory(stored.id);
										setTemplateHistory(loadTemplateHistory());
										if (activeTemplateId === stored.id) setActiveTemplateId(null);
									}}
									isLoadingAudio={isLoadingAudio && isActive}
								/>
							);
						})}
					</div>

					{templateHistory.length > 0 && (
						<button
							type="button"
							className="text-[9px] text-muted-foreground hover:text-destructive mt-3 w-full text-center"
							onClick={() => {
								clearTemplateHistory();
								setTemplateHistory([]);
								setActiveTemplateId(null);
							}}
						>
							Clear all templates
						</button>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Collapsible template history card
// ---------------------------------------------------------------------------

function TemplateHistoryCard({
	stored,
	isExpanded,
	onToggle,
	onImport,
	onSaveToIdeas,
	onRemove,
	isLoadingAudio,
}: {
	stored: StoredTemplate;
	isExpanded: boolean;
	onToggle: () => void;
	onImport: () => void;
	onSaveToIdeas: () => void;
	onRemove: () => void;
	isLoadingAudio: boolean;
}) {
	const t = stored.result;

	return (
		<div
			className={cn(
				"rounded-lg border overflow-hidden transition-colors",
				stored.imported
					? "border-green-500/20 bg-green-500/5"
					: isExpanded
						? "border-primary/30"
						: "border-border",
			)}
		>
			{/* Collapsed header — always visible */}
			<div
				className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-accent/50"
				onClick={onToggle}
			>
				<span className="text-[10px]">{isExpanded ? "▾" : "▸"}</span>
				<div className="flex-1 min-w-0">
					<p className="text-xs font-medium truncate">{t.title}</p>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					<Badge variant="secondary" className="text-[8px] px-1 py-0">
						{t.total_duration}s
					</Badge>
					<Badge variant="secondary" className="text-[8px] px-1 py-0">
						{t.segments.length} seg
					</Badge>
					{stored.imported && (
						<HugeiconsIcon icon={Tick01Icon} className="size-3 text-green-500" />
					)}
				</div>
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<div className="px-3 pb-3 border-t space-y-2 pt-2">
					{/* Style & info */}
					<div className="flex items-center gap-1.5">
						<Badge variant="outline" className="text-[9px] px-1 py-0">
							{t.style}
						</Badge>
						{t.background_audio && (
							<div className="flex items-center gap-1">
								<HugeiconsIcon icon={MusicNote03Icon} className="size-3 text-muted-foreground" />
								<span className="text-[9px] text-muted-foreground">
									{t.background_audio.mood}
								</span>
							</div>
						)}
					</div>

					{/* Segments */}
					<div className="space-y-1.5">
						{t.segments.map((segment) => (
							<SegmentCard key={segment.order} segment={segment} />
						))}
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-1.5 pt-1">
						{!stored.imported && (
							<Button
								onClick={(e) => { e.stopPropagation(); onImport(); }}
								disabled={isLoadingAudio}
								className="w-full"
								size="sm"
							>
								{isLoadingAudio ? (
									<>
										<Spinner className="size-3.5 mr-2" />
										Adding to timeline...
									</>
								) : (
									<>
										<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 mr-2" />
										Add to Timeline
									</>
								)}
							</Button>
						)}
						{stored.imported && (
							<div className="flex items-center gap-1 text-[10px] text-green-500 justify-center">
								<HugeiconsIcon icon={Tick01Icon} className="size-3" />
								Added to Timeline
							</div>
						)}
						<div className="flex gap-1.5">
							<Button
								variant="outline"
								size="sm"
								className="flex-1 h-6 text-[9px]"
								onClick={(e) => { e.stopPropagation(); onSaveToIdeas(); }}
							>
								Save to Ideas
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 text-[9px] text-muted-foreground hover:text-destructive"
								onClick={(e) => { e.stopPropagation(); onRemove(); }}
							>
								Remove
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Segment card (inside a template)
// ---------------------------------------------------------------------------

function SegmentCard({ segment }: { segment: ReelTemplateSegment }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="rounded-lg border bg-card overflow-hidden">
			{/* Header — always visible */}
			<div
				className="px-3 py-2 flex items-center gap-2 cursor-pointer"
				onClick={() => setExpanded(!expanded)}
			>
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
				<svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="none"
					className={cn(
						"text-muted-foreground transition-transform shrink-0",
						expanded && "rotate-90",
					)}
				>
					<path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</div>

			{expanded && (
				<div className="px-3 pb-3 space-y-2.5 border-t pt-2">
					{/* Content sections */}
					{segment.key_message?.trim() ? (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={SparklesIcon} className="size-3 text-primary" />
								<p className="text-[10px] font-medium text-primary uppercase tracking-wider">Key Message</p>
							</div>
							<p className="text-xs font-semibold">{segment.key_message}</p>
						</div>
					) : (
						<p className="text-[10px] text-muted-foreground/50 italic">No key message generated</p>
					)}
					{segment.narration?.trim() ? (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={Mic01Icon} className="size-3 text-muted-foreground" />
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Voiceover Script</p>
							</div>
							<p className="text-xs text-muted-foreground">{segment.narration}</p>
						</div>
					) : (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={Mic01Icon} className="size-3 text-muted-foreground/40" />
								<p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Voiceover Script</p>
							</div>
							<p className="text-[10px] text-muted-foreground/50 italic">No voiceover script — try regenerating or edit manually</p>
						</div>
					)}
					{segment.visual_description?.trim() ? (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={ViewIcon} className="size-3 text-muted-foreground" />
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Visual Direction</p>
							</div>
							<p className="text-xs text-muted-foreground italic">{segment.visual_description}</p>
						</div>
					) : (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={ViewIcon} className="size-3 text-muted-foreground/40" />
								<p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Visual Direction</p>
							</div>
							<p className="text-[10px] text-muted-foreground/50 italic">No visual description — try regenerating or edit manually</p>
						</div>
					)}
					{segment.audio_mood?.trim() && (
						<div>
							<div className="flex items-center gap-1 mb-0.5">
								<HugeiconsIcon icon={MusicNote03Icon} className="size-3 text-muted-foreground" />
								<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Audio Mood</p>
							</div>
							<p className="text-xs text-muted-foreground">{segment.audio_mood}</p>
						</div>
					)}

				</div>
			)}
		</div>
	);
}
