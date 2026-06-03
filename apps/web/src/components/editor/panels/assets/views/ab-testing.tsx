"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Image02Icon,
	SparklesIcon,
	Analytics01Icon,
	ArrowLeft01Icon,
	Award01Icon,
	FavouriteCircleIcon,
} from "@hugeicons/core-free-icons";
import { useABTesting } from "@/hooks/use-ab-testing";
import { useThumbnailGen } from "@/hooks/use-thumbnail-gen";
import { useTranscriptStore } from "@/stores/transcript-store";
import type { ThumbnailScoreResult, HookVariant, ScoreAnalyticsResponse } from "@/lib/ai-client";

const GRADE_COLORS: Record<string, string> = {
	A: "text-green-400 border-green-500/50",
	B: "text-blue-400 border-blue-500/50",
	C: "text-yellow-400 border-yellow-500/50",
	D: "text-orange-400 border-orange-500/50",
	F: "text-red-400 border-red-500/50",
};

const GRADE_BG: Record<string, string> = {
	A: "bg-green-500/10",
	B: "bg-blue-500/10",
	C: "bg-yellow-500/10",
	D: "bg-orange-500/10",
	F: "bg-red-500/10",
};

type ABTab = "thumbnails" | "hooks" | "analytics";

export function ABTestingPanel({ className }: { className?: string }) {
	const [activeTab, setActiveTab] = useState<ABTab>("thumbnails");
	const ab = useABTesting();
	const { generate, generatedThumbnails } = useThumbnailGen();
	const segments = useTranscriptStore((s) => s.segments);
	const [headline, setHeadline] = useState("");
	const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);
	const [selectedThumb, setSelectedThumb] = useState<number | null>(null);
	const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);

	const handleGenerateAndScore = useCallback(async () => {
		setIsGeneratingThumbs(true);
		try {
			const results = await generate(
				{
					prompt: "",
					style: "cinematic",
					colorScheme: "vibrant",
					width: 1280,
					height: 720,
					includeText: !!headline,
					headline,
				},
				4,
			);
			if (results && results.length > 0) {
				const urls = results.map((r) => r.imageUrl);
				await ab.scoreThumbnails(urls, headline);
			}
		} finally {
			setIsGeneratingThumbs(false);
		}
	}, [generate, headline, ab]);

	const handleScoreExisting = useCallback(async () => {
		if (generatedThumbnails.length === 0) return;
		const urls = generatedThumbnails.map((t) => t.imageUrl);
		await ab.scoreThumbnails(urls, headline);
	}, [generatedThumbnails, headline, ab]);

	const handleGenerateHooks = useCallback(async () => {
		const text = segments.map((s) => s.text).join(" ").slice(0, 2000);
		if (!text) return;
		setIsGeneratingHooks(true);
		try {
			await ab.generateHookVariants(text, 0, 30, 5);
		} finally {
			setIsGeneratingHooks(false);
		}
	}, [segments, ab]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Analytics01Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">A/B Testing</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Test thumbnails & hooks to maximize engagement.
				</p>
			</div>

			<div className="flex border-b shrink-0">
				{([
					{ key: "thumbnails" as ABTab, label: "Thumbnails", icon: Image02Icon },
					{ key: "hooks" as ABTab, label: "Hooks", icon: SparklesIcon },
					{ key: "analytics" as ABTab, label: "Analytics", icon: Analytics01Icon },
				]).map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => setActiveTab(tab.key)}
						className={cn(
							"flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors border-b-2",
							activeTab === tab.key
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<HugeiconsIcon icon={tab.icon} className="size-3" />
						{tab.label}
					</button>
				))}
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
				{activeTab === "thumbnails" && (
					<ThumbnailsTab
						headline={headline}
						setHeadline={setHeadline}
						isGenerating={isGeneratingThumbs}
						onGenerate={handleGenerateAndScore}
						onScoreExisting={handleScoreExisting}
						hasExisting={generatedThumbnails.length > 0}
						scores={ab.thumbnailScores}
						selected={selectedThumb}
						onSelect={setSelectedThumb}
						loading={ab.loading}
					/>
				)}
				{activeTab === "hooks" && (
					<HooksTab
						isGenerating={isGeneratingHooks}
						onGenerate={handleGenerateHooks}
						variants={ab.hookVariants}
						loading={ab.loading}
						hasTranscript={segments.length > 0}
					/>
				)}
				{activeTab === "analytics" && (
					<AnalyticsTab
						analytics={ab.analytics}
						loading={ab.loading}
						onRefresh={() => ab.fetchAnalytics()}
					/>
				)}
			</div>
		</div>
	);
}

function ScoreBar({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-center gap-2 text-[9px]">
			<span className="w-20 text-muted-foreground truncate">{label}</span>
			<div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
				<div
					className={cn(
						"h-full rounded-full transition-all",
						value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500",
					)}
					style={{ width: `${Math.min(100, value)}%` }}
				/>
			</div>
			<span className="w-6 text-right font-mono">{Math.round(value)}</span>
		</div>
	);
}

function ThumbnailsTab({
	headline,
	setHeadline,
	isGenerating,
	onGenerate,
	onScoreExisting,
	hasExisting,
	scores,
	selected,
	onSelect,
	loading,
}: {
	headline: string;
	setHeadline: (v: string) => void;
	isGenerating: boolean;
	onGenerate: () => void;
	onScoreExisting: () => void;
	hasExisting: boolean;
	scores: { results: ThumbnailScoreResult[]; winner_index: number; winner_score: number } | null;
	selected: number | null;
	onSelect: (i: number | null) => void;
	loading: boolean;
}) {
	return (
		<>
			<div className="space-y-1.5">
				<span className="text-[10px] text-muted-foreground">Headline (optional)</span>
				<input
					className="w-full rounded border bg-transparent px-2 py-1 text-[10px] placeholder:text-muted-foreground"
					placeholder="e.g., TOP 10 TIPS"
					value={headline}
					onChange={(e) => setHeadline(e.target.value)}
				/>
			</div>

			<div className="flex gap-2">
				<Button className="flex-1" size="sm" onClick={onGenerate} disabled={isGenerating}>
					{isGenerating ? (
						<><Spinner className="size-3 mr-1" /> Generating...</>
					) : (
						"Generate & Score 4"
					)}
				</Button>
				{hasExisting && (
					<Button variant="outline" size="sm" onClick={onScoreExisting} disabled={loading}>
						Score Existing
					</Button>
				)}
			</div>

			{scores && scores.results.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-[10px] font-medium">Results</span>
						<Badge variant="outline" className="text-[8px]">
							<HugeiconsIcon icon={Award01Icon} className="size-3 mr-1" />
							Winner: #{scores.winner_index + 1} ({scores.winner_score})
						</Badge>
					</div>

					{scores.results.map((s, i) => (
						<button
							key={i}
							type="button"
							onClick={() => onSelect(selected === i ? null : i)}
							className={cn(
								"w-full rounded-lg border p-2 text-left transition-colors",
								i === scores.winner_index ? "border-green-500/50 bg-green-500/5" : "hover:bg-accent/50",
								selected === i && "ring-1 ring-primary",
							)}
						>
							<div className="flex items-center justify-between mb-1">
								<div className="flex items-center gap-1.5">
									<span className="text-[10px] font-medium">Variant {i + 1}</span>
									{i === scores.winner_index && (
										<Badge className="text-[7px] h-4 bg-green-500/20 text-green-400 border-green-500/30">
											Recommended
										</Badge>
									)}
								</div>
								<div className={cn("text-lg font-bold", GRADE_COLORS[s.grade])}>
									{s.grade}
								</div>
							</div>
							<div className="flex items-center gap-2 mb-1">
								<span className="text-[16px] font-bold">{Math.round(s.overall)}</span>
								<span className="text-[9px] text-muted-foreground">/100</span>
							</div>
							<ScoreBar label="Contrast" value={s.contrast} />
							<ScoreBar label="Text Readability" value={s.text_readability} />
							<ScoreBar label="Face Presence" value={s.face_presence} />
							<ScoreBar label="Color Vibrancy" value={s.color_vibrancy} />
							<ScoreBar label="Composition" value={s.composition} />
							{s.suggestion && (
								<p className="text-[8px] text-muted-foreground mt-1">{s.suggestion}</p>
							)}
						</button>
					))}
				</div>
			)}
		</>
	);
}

function HooksTab({
	isGenerating,
	onGenerate,
	variants,
	loading,
	hasTranscript,
}: {
	isGenerating: boolean;
	onGenerate: () => void;
	variants: { variants: HookVariant[]; total: number } | null;
	loading: boolean;
	hasTranscript: boolean;
}) {
	return (
		<>
			{!hasTranscript && (
				<div className="rounded-lg border border-dashed p-4 text-center">
					<p className="text-[10px] text-muted-foreground">
						Add a transcript to generate hook variants.
					</p>
				</div>
			)}

			{hasTranscript && (
				<Button className="w-full" size="sm" onClick={onGenerate} disabled={isGenerating}>
					{isGenerating ? (
						<><Spinner className="size-3 mr-1" /> Generating hooks...</>
					) : (
						"Generate 5 Hook Variants"
					)}
				</Button>
			)}

			{variants && variants.variants.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-[10px] font-medium">Hook Variants ({variants.total})</span>
					</div>

					{variants.variants.map((v, i) => {
						const bestScore = Math.max(...variants.variants.map((hv) => hv.estimated_score));
						const isBest = v.estimated_score === bestScore;
						return (
							<div
								key={i}
								className={cn(
									"rounded-lg border p-2 space-y-1",
									isBest && "border-green-500/50 bg-green-500/5",
								)}
							>
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-medium">Variant {i + 1}</span>
									<div className="flex items-center gap-1">
										{isBest && (
											<Badge className="text-[7px] h-4 bg-green-500/20 text-green-400 border-green-500/30">
												Best
											</Badge>
										)}
										<Badge variant="outline" className={cn("text-[8px]", GRADE_COLORS[v.estimated_score >= 70 ? "A" : v.estimated_score >= 50 ? "C" : "F"])}>
											{Math.round(v.estimated_score)}
										</Badge>
									</div>
								</div>
								<p className="text-[10px]">{v.text}</p>
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="text-[7px]">{v.style}</Badge>
									<span className="text-[8px] text-muted-foreground">{v.reason}</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</>
	);
}

function AnalyticsTab({
	analytics,
	loading,
	onRefresh,
}: {
	analytics: ScoreAnalyticsResponse | null;
	loading: boolean;
	onRefresh: () => void;
}) {
	return (
		<>
			<div className="flex justify-between items-center">
				<span className="text-[10px] font-medium">Score Analytics</span>
				<Button variant="ghost" size="sm" className="h-5 text-[8px]" onClick={onRefresh} disabled={loading}>
					Refresh
				</Button>
			</div>

			{!analytics || analytics.total_scored === 0 ? (
				<div className="rounded-lg border border-dashed p-4 text-center">
					<HugeiconsIcon icon={Analytics01Icon} className="size-6 mx-auto mb-2 text-muted-foreground" />
					<p className="text-[10px] text-muted-foreground">
						No scores recorded yet. Score thumbnails or videos to build analytics.
					</p>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 gap-2">
						<div className={cn("rounded-lg border p-2 text-center", GRADE_BG[analytics.avg_composite >= 70 ? "A" : analytics.avg_composite >= 50 ? "C" : "F"])}>
							<span className="text-[8px] text-muted-foreground">Avg Score</span>
							<div className="text-lg font-bold">{analytics.avg_composite}</div>
						</div>
						<div className="rounded-lg border p-2 text-center">
							<span className="text-[8px] text-muted-foreground">Total Scored</span>
							<div className="text-lg font-bold">{analytics.total_scored}</div>
						</div>
					</div>

					{analytics.grade_distribution && Object.keys(analytics.grade_distribution).length > 0 && (
						<div className="space-y-1">
							<span className="text-[10px] font-medium">Grade Distribution</span>
							<div className="flex gap-1">
								{(["A", "B", "C", "D", "F"] as const).map((g) => {
									const count = analytics.grade_distribution[g] ?? 0;
									const total = Object.values(analytics.grade_distribution).reduce((a, b) => a + b, 0);
									const pct = total > 0 ? (count / total) * 100 : 0;
									return (
										<div key={g} className={cn("flex-1 rounded border p-1 text-center", GRADE_BG[g])}>
											<div className={cn("text-[10px] font-bold", GRADE_COLORS[g]?.split(" ")[0])}>{g}</div>
											<div className="text-[8px] text-muted-foreground">{count}</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{analytics.avg_sub_scores && Object.keys(analytics.avg_sub_scores).length > 0 && (
						<div className="space-y-1">
							<span className="text-[10px] font-medium">Avg Sub-Scores</span>
							{Object.entries(analytics.avg_sub_scores).map(([key, val]) => (
								<ScoreBar key={key} label={key.replace(/_/g, " ")} value={val as number} />
							))}
						</div>
					)}

					{analytics.strongest_signal && (
						<div className="rounded-lg border p-2 space-y-1">
							<div className="flex items-center gap-1">
								<HugeiconsIcon icon={FavouriteCircleIcon} className="size-3 text-green-400" />
								<span className="text-[9px] font-medium text-green-400">Strongest: {analytics.strongest_signal.replace(/_/g, " ")}</span>
							</div>
							<div className="flex items-center gap-1">
								<HugeiconsIcon icon={ArrowLeft01Icon} className="size-3 text-orange-400" />
								<span className="text-[9px] font-medium text-orange-400">Weakest: {analytics.weakest_signal.replace(/_/g, " ")}</span>
							</div>
						</div>
					)}

					{analytics.trend && analytics.trend.length > 1 && (
						<div className="space-y-1">
							<span className="text-[10px] font-medium">Score Trend</span>
							<div className="flex items-end gap-0.5 h-16">
								{analytics.trend.map((point, i) => {
									const height = analytics.avg_composite > 0
										? (point.avg_composite / 100) * 100
										: 0;
									return (
										<div
											key={i}
											className="flex-1 rounded-t bg-primary/60 transition-all"
											style={{ height: `${Math.max(4, height)}%` }}
											title={`Score: ${point.avg_composite} (${point.count} scores)`}
										/>
									);
								})}
							</div>
						</div>
					)}
				</>
			)}
		</>
	);
}
