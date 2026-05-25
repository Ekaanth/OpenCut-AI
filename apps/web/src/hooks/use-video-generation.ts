import { useCallback, useRef, useState } from "react";

import { aiClient } from "@/lib/ai-client";
import { getApiKey } from "@/lib/api-keys";
import {
	VIDEO_MODELS,
	VIDEO_ASPECT_RATIOS,
	getModelById,
	getProviderForModel,
	isProviderKeyRequired,
	type VideoGenMode,
	type VideoModel,
} from "@/lib/video-gen/video-gen-types";
import type { VideoGenRequest, VideoGenResult } from "@/types/ai";

export type VideoGenStatus = "idle" | "enhancing" | "generating" | "polling" | "done" | "error";

export interface VideoGenJob {
	id: string;
	model: string;
	provider: string;
	prompt: string;
	mode: VideoGenMode;
	status: "processing" | "completed" | "failed";
	videoUrl?: string;
	error?: string;
	createdAt: number;
}

export interface UseVideoGenerationReturn {
	status: VideoGenStatus;
	progress: number;
	currentJob: VideoGenJob | null;
	jobs: VideoGenJob[];
	error: string | null;
	selectedModel: string;
	selectedAspectRatio: string;
	duration: number;
	genMode: VideoGenMode;
	imageUrl: string;
	setSelectedModel: (m: string) => void;
	setSelectedAspectRatio: (r: string) => void;
	setDuration: (d: number) => void;
	setGenMode: (m: VideoGenMode) => void;
	setImageUrl: (u: string) => void;
	generate: (prompt: string) => Promise<void>;
	enhancePrompt: (prompt: string) => Promise<string>;
	addToTimeline: (videoUrl: string) => void;
	clearJob: (jobId: string) => void;
	clearError: () => void;
}

export function useVideoGeneration(): UseVideoGenerationReturn {
	const [status, setStatus] = useState<VideoGenStatus>("idle");
	const [progress, setProgress] = useState(0);
	const [currentJob, setCurrentJob] = useState<VideoGenJob | null>(null);
	const [jobs, setJobs] = useState<VideoGenJob[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [selectedModel, setSelectedModel] = useState("runway-gen3-alpha");
	const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
	const [duration, setDuration] = useState(5);
	const [genMode, setGenMode] = useState<VideoGenMode>("text-to-video");
	const [imageUrl, setImageUrl] = useState("");
	const cancelRef = useRef(false);

	const model = getModelById(selectedModel);
	const provider = model?.provider || "replicate";

	const generate = useCallback(
		async (prompt: string) => {
			if (!prompt.trim()) return;

			const m = getModelById(selectedModel);
			if (!m) {
				setError("Invalid model selected");
				return;
			}

			if (isProviderKeyRequired(m.provider)) {
				const config = getProviderKeyConfig(m.provider);
				const key = getApiKey(config.localStorageKey) || getEnvKey(config.envVar);
				if (!key) {
					setError(`${config.label} API key not configured. Add it in Settings > API Keys.`);
					return;
				}
			}

			setStatus("generating");
			setProgress(0);
			setError(null);
			cancelRef.current = false;

			const ar = VIDEO_ASPECT_RATIOS.find((r) => r.id === selectedAspectRatio) || VIDEO_ASPECT_RATIOS[0];

			const request: VideoGenRequest = {
				prompt,
				duration,
				width: ar.width,
				height: ar.height,
				provider: m.provider as VideoGenRequest["provider"],
				model: m.id,
				mode: genMode,
				imageUrl: genMode === "image-to-video" ? imageUrl : undefined,
			};

			try {
				const result = await aiClient.generateVideo(request);

				const job: VideoGenJob = {
					id: result.jobId || `local-${Date.now()}`,
					model: m.id,
					provider: m.provider,
					prompt,
					mode: genMode,
					status: "processing",
					createdAt: Date.now(),
				};
				setCurrentJob(job);
				setJobs((prev) => [job, ...prev]);

				if (result.status === "completed" && result.videoUrl) {
					const completed = { ...job, status: "completed" as const, videoUrl: result.videoUrl };
					setCurrentJob(completed);
					setJobs((prev) => prev.map((j) => (j.id === job.id ? completed : j)));
					setStatus("done");
					return;
				}

				if (result.status === "failed") {
					const failed = { ...job, status: "failed" as const, error: result.error || "Generation failed" };
					setCurrentJob(failed);
					setJobs((prev) => prev.map((j) => (j.id === job.id ? failed : j)));
					setStatus("error");
					setError(failed.error);
					return;
				}

				setStatus("polling");

				const jobId = result.jobId;
				if (!jobId) {
					setStatus("error");
					setError("No job ID returned");
					return;
				}

				const maxPolls = 120;
				for (let i = 0; i < maxPolls; i++) {
					if (cancelRef.current) {
						setStatus("idle");
						return;
					}

					await new Promise((r) => setTimeout(r, 3000));
					setProgress(Math.round(((i + 1) / maxPolls) * 100));

					const pollResult = await aiClient.getVideoJob(jobId, m.provider);

					if (pollResult.status === "completed" && pollResult.videoUrl) {
						const completed = { ...job, status: "completed" as const, videoUrl: pollResult.videoUrl };
						setCurrentJob(completed);
						setJobs((prev) => prev.map((j) => (j.id === job.id ? completed : j)));
						setStatus("done");
						return;
					}

					if (pollResult.status === "failed") {
						const failed = { ...job, status: "failed" as const, error: pollResult.error || "Generation failed" };
						setCurrentJob(failed);
						setJobs((prev) => prev.map((j) => (j.id === job.id ? failed : j)));
						setStatus("error");
						setError(failed.error);
						return;
					}
				}

				setStatus("error");
				setError("Generation timed out");
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Video generation failed");
			}
		},
		[selectedModel, selectedAspectRatio, duration, genMode, imageUrl],
	);

	const enhancePrompt = useCallback(async (prompt: string): Promise<string> => {
		try {
			const result = await aiClient.generateVideoPrompt("", prompt, "cinematic");
			return result.prompt || prompt;
		} catch {
			return prompt;
		}
	}, []);

	const addToTimeline = useCallback(
		(videoUrl: string) => {
			const m = getModelById(selectedModel);
			const ar = VIDEO_ASPECT_RATIOS.find((r) => r.id === selectedAspectRatio) || VIDEO_ASPECT_RATIOS[0];

			const editor = (globalThis as Record<string, unknown>).__opencut_editor;
			if (editor && typeof editor === "object" && "timeline" in editor) {
				const editorObj = editor as { timeline: { addTrack: (args: { type: string }) => string; insertElement: (args: { element: Record<string, unknown>; placement: Record<string, unknown> }) => void; getTracks: () => Array<{ id: string }> } };
				const trackId = editorObj.timeline.addTrack({ type: "video" });
				editorObj.timeline.insertElement({
					element: {
						type: "video",
						name: `AI Video — ${m?.name || "Generated"}`,
						duration: duration,
						startTime: 0,
						trimStart: 0,
						trimEnd: 0,
						sourceDuration: duration,
						transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
						opacity: 1,
						url: videoUrl,
						width: ar.width,
						height: ar.height,
					},
					placement: { trackId, position: "after" },
				});
			}
		},
		[selectedModel, selectedAspectRatio, duration],
	);

	const clearJob = useCallback((jobId: string) => {
		setJobs((prev) => prev.filter((j) => j.id !== jobId));
	}, []);

	const clearError = useCallback(() => {
		setError(null);
		setStatus("idle");
	}, []);

	return {
		status, progress, currentJob, jobs, error,
		selectedModel, selectedAspectRatio, duration, genMode, imageUrl,
		setSelectedModel, setSelectedAspectRatio, setDuration, setGenMode, setImageUrl,
		generate, enhancePrompt, addToTimeline, clearJob, clearError,
	};
}

function getProviderKeyConfig(provider: string): { localStorageKey: string; envVar: string; label: string } {
	switch (provider) {
		case "replicate": return { localStorageKey: "replicate", envVar: "NEXT_PUBLIC_REPLICATE_API_TOKEN", label: "Replicate" };
		case "seedance": return { localStorageKey: "seedance", envVar: "NEXT_PUBLIC_SEEDANCE_API_KEY", label: "Seedance" };
		case "stability": return { localStorageKey: "stability", envVar: "NEXT_PUBLIC_STABILITY_API_KEY", label: "Stability AI" };
		case "luma": return { localStorageKey: "luma", envVar: "NEXT_PUBLIC_LUMA_API_KEY", label: "Luma AI" };
		default: return { localStorageKey: "", envVar: "", label: "" };
	}
}

function getEnvKey(envVar: string): string | undefined {
	if (typeof process === "undefined" || !process.env) return undefined;
	return (process.env as Record<string, string | undefined>)[envVar];
}
