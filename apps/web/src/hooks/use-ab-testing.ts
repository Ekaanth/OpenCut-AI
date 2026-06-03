import { useCallback, useState } from "react";
import { aiClient } from "@/lib/ai-client";
import type {
	ThumbnailScoreResponse,
	HookVariantResponse,
	ScoreHistoryResponse,
	ScoreAnalyticsResponse,
	EngagementScoreResult,
} from "@/lib/ai-client";
import { toast } from "sonner";

export function useABTesting() {
	const [thumbnailScores, setThumbnailScores] = useState<ThumbnailScoreResponse | null>(null);
	const [hookVariants, setHookVariants] = useState<HookVariantResponse | null>(null);
	const [scoreHistory, setScoreHistory] = useState<ScoreHistoryResponse | null>(null);
	const [analytics, setAnalytics] = useState<ScoreAnalyticsResponse | null>(null);
	const [loading, setLoading] = useState(false);

	const scoreThumbnails = useCallback(async (imageUrls: string[], headline?: string) => {
		setLoading(true);
		try {
			const result = await aiClient.scoreThumbnails(imageUrls, headline);
			setThumbnailScores(result);
			toast.success(`Scored ${result.results.length} thumbnails`);
			return result;
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Thumbnail scoring failed";
			toast.error("Scoring failed", { description: msg });
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const generateHookVariants = useCallback(
		async (transcriptText: string, clipStart?: number, clipEnd?: number, maxVariants?: number) => {
			setLoading(true);
			try {
				const result = await aiClient.generateHookVariants({
					transcript_text: transcriptText,
					clip_start: clipStart ?? 0,
					clip_end: clipEnd ?? 30,
					max_variants: maxVariants ?? 5,
				});
				setHookVariants(result);
				toast.success(`Generated ${result.total} hook variants`);
				return result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Hook generation failed";
				toast.error("Hook generation failed", { description: msg });
				return null;
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	const recordScore = useCallback(
		async (score: EngagementScoreResult, projectId?: string, type?: string) => {
			try {
				await aiClient.recordScore({
					...score,
					project_id: projectId,
					type: type ?? "video",
				});
			} catch {
				// silent fail - recording is non-critical
			}
		},
		[],
	);

	const fetchHistory = useCallback(async (projectId?: string, limit?: number) => {
		setLoading(true);
		try {
			const result = await aiClient.getScoreHistory(projectId, limit);
			setScoreHistory(result);
			return result;
		} catch (err) {
			toast.error("Failed to load score history");
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchAnalytics = useCallback(async (projectId?: string) => {
		setLoading(true);
		try {
			const result = await aiClient.getScoreAnalytics(projectId);
			setAnalytics(result);
			return result;
		} catch (err) {
			toast.error("Failed to load analytics");
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	const clearResults = useCallback(() => {
		setThumbnailScores(null);
		setHookVariants(null);
	}, []);

	return {
		thumbnailScores,
		hookVariants,
		scoreHistory,
		analytics,
		loading,
		scoreThumbnails,
		generateHookVariants,
		recordScore,
		fetchHistory,
		fetchAnalytics,
		clearResults,
	};
}
