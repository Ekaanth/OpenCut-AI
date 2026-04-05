import { create } from "zustand";
import { aiClient } from "@/lib/ai-client";
import type {
	YouTubeVideoMeta,
	YouTubeJobStatus,
	ScoredClipData,
	EngagementScoreResult,
} from "@/lib/ai-client";

type Phase = "idle" | "input" | "confirming" | "configuring" | "processing" | "reviewing" | "exporting" | "done" | "error";

interface ReelsConfig {
	minDuration: number;
	maxDuration: number;
	maxClips: number;
	outputFormat: "9:16" | "1:1" | "4:5";
	captionStyle: "modern" | "karaoke" | "classic" | "none";
	autoReframe: boolean;
	addHook: boolean;
	language: string | null;
}

interface YouTubeReelsState {
	// Current phase
	phase: Phase;

	// Input
	videoUrl: string;
	videoMeta: YouTubeVideoMeta | null;

	// Jobs
	ingestJobId: string | null;
	analyzeJobId: string | null;
	generateJobId: string | null;
	jobStatus: string;
	jobProgress: number;
	jobMessage: string;
	jobError: string | null;

	// Results
	detectedClips: ScoredClipData[];
	selectedIndices: Set<number>;
	generatedClips: { clip_index: number; file_path: string; duration: number; file_size_mb: number; thumbnail_path: string | null }[];

	// Config
	config: ReelsConfig;

	// Polling
	_pollTimer: ReturnType<typeof setInterval> | null;
	_pollFailures: number;

	// Actions
	setVideoUrl: (url: string) => void;
	setPhase: (phase: Phase) => void;
	setConfig: (partial: Partial<ReelsConfig>) => void;

	startIngestion: () => Promise<void>;
	startAnalysis: () => Promise<void>;
	startGeneration: () => Promise<void>;

	toggleClipSelection: (index: number) => void;
	selectAll: () => void;
	deselectAll: () => void;

	cancelJob: () => Promise<void>;
	reset: () => void;

	_startPolling: (jobId: string, onComplete: (result: Record<string, unknown>) => void) => void;
	_stopPolling: () => void;
}

const DEFAULT_CONFIG: ReelsConfig = {
	minDuration: 15,
	maxDuration: 60,
	maxClips: 10,
	outputFormat: "9:16",
	captionStyle: "modern",
	autoReframe: true,
	addHook: false,
	language: null,
};

export const useYouTubeReelsStore = create<YouTubeReelsState>()((set, get) => ({
	phase: "idle",
	videoUrl: "",
	videoMeta: null,
	ingestJobId: null,
	analyzeJobId: null,
	generateJobId: null,
	jobStatus: "",
	jobProgress: 0,
	jobMessage: "",
	jobError: null,
	detectedClips: [],
	selectedIndices: new Set(),
	generatedClips: [],
	config: { ...DEFAULT_CONFIG },
	_pollTimer: null,
	_pollFailures: 0,

	setVideoUrl: (url) => set({ videoUrl: url }),
	setPhase: (phase) => set({ phase }),
	setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),

	startIngestion: async () => {
		const { videoUrl, config } = get();
		set({ phase: "processing", jobProgress: 0, jobMessage: "Fetching video metadata...", jobError: null });

		try {
			const resp = await aiClient.youtubeIngest(videoUrl, true, config.language ?? undefined);
			set({
				videoMeta: resp.video_meta,
				ingestJobId: resp.job_id,
				jobMessage: "Downloading audio...",
			});

			// Poll for download completion
			get()._startPolling(resp.job_id, (result) => {
				set({ phase: "configuring", jobMessage: "Audio ready. Configure clip settings." });
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Ingestion failed";
			set({ phase: "error", jobError: msg });
		}
	},

	startAnalysis: async () => {
		const { ingestJobId, config } = get();
		if (!ingestJobId) return;

		set({ phase: "processing", jobProgress: 0.1, jobMessage: "Starting clip detection..." });

		try {
			const resp = await aiClient.youtubeAnalyze(ingestJobId, {
				minDuration: config.minDuration,
				maxDuration: config.maxDuration,
				maxClips: config.maxClips,
			});

			set({ analyzeJobId: resp.job_id });

			get()._startPolling(resp.job_id, (result) => {
				const clips = (result.clips ?? []) as ScoredClipData[];
				const allIndices = new Set(clips.map((c: ScoredClipData) => c.index));
				set({
					phase: "reviewing",
					detectedClips: clips,
					selectedIndices: allIndices,
					jobMessage: `Found ${clips.length} clips`,
				});
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Analysis failed";
			set({ phase: "error", jobError: msg });
		}
	},

	startGeneration: async () => {
		const { analyzeJobId, detectedClips, selectedIndices, config } = get();
		if (!analyzeJobId) return;

		const selected = detectedClips.filter((c) => selectedIndices.has(c.index));
		if (selected.length === 0) return;

		set({ phase: "exporting", jobProgress: 0, jobMessage: `Generating ${selected.length} reels...` });

		try {
			const resp = await aiClient.youtubeGenerateClips(
				analyzeJobId,
				selected.map((c) => ({
					clip_index: c.index,
					start: c.start,
					end: c.end,
					title: c.title,
				})),
				{
					outputFormat: config.outputFormat,
					captionStyle: config.captionStyle,
					autoReframe: config.autoReframe,
					addHook: config.addHook,
				},
			);

			set({ generateJobId: resp.job_id });

			get()._startPolling(resp.job_id, (result) => {
				const clips = (result.clips ?? []) as YouTubeReelsState["generatedClips"];
				set({ phase: "done", generatedClips: clips, jobMessage: `Generated ${clips.length} reels` });
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Generation failed";
			set({ phase: "error", jobError: msg });
		}
	},

	toggleClipSelection: (index) =>
		set((s) => {
			const next = new Set(s.selectedIndices);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return { selectedIndices: next };
		}),

	selectAll: () =>
		set((s) => ({
			selectedIndices: new Set(s.detectedClips.map((c) => c.index)),
		})),

	deselectAll: () => set({ selectedIndices: new Set() }),

	cancelJob: async () => {
		const { ingestJobId, analyzeJobId, generateJobId } = get();
		const jobId = generateJobId ?? analyzeJobId ?? ingestJobId;
		if (jobId) {
			try { await aiClient.youtubeCancel(jobId); } catch { /* ignore */ }
		}
		get()._stopPolling();
		set({ phase: "idle", jobError: "Cancelled" });
	},

	reset: () => {
		get()._stopPolling();
		set({
			phase: "idle",
			videoUrl: "",
			videoMeta: null,
			ingestJobId: null,
			analyzeJobId: null,
			generateJobId: null,
			jobStatus: "",
			jobProgress: 0,
			jobMessage: "",
			jobError: null,
			detectedClips: [],
			selectedIndices: new Set(),
			generatedClips: [],
			config: { ...DEFAULT_CONFIG },
			_pollFailures: 0,
		});
	},

	_startPolling: (jobId, onComplete) => {
		get()._stopPolling();
		set({ _pollFailures: 0 });

		const timer = setInterval(async () => {
			try {
				const status = await aiClient.youtubeJobStatus(jobId);
				set({
					jobStatus: status.status,
					jobProgress: status.progress,
					jobMessage: status.message,
					_pollFailures: 0,
				});

				if (status.status === "completed" && status.result) {
					get()._stopPolling();
					onComplete(status.result);
				} else if (status.status === "failed") {
					get()._stopPolling();
					set({ phase: "error", jobError: status.error || "Job failed" });
				}
			} catch {
				const failures = get()._pollFailures + 1;
				set({ _pollFailures: failures });
				if (failures >= 10) {
					get()._stopPolling();
					set({ phase: "error", jobError: "Lost connection to backend. Please try again." });
				}
			}
		}, 2000);

		set({ _pollTimer: timer });
	},

	_stopPolling: () => {
		const { _pollTimer } = get();
		if (_pollTimer) {
			clearInterval(_pollTimer);
			set({ _pollTimer: null });
		}
	},
}));
