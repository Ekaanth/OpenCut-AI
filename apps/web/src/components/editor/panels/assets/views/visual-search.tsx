"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEditor } from "@/hooks/use-editor";
import { useVisualSearch } from "@/hooks/use-visual-search";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import {
	findDuplicates,
	type DuplicatePair,
} from "@/services/search/embedding-service";
import { useSearchStore } from "@/stores/search-store";
import type { MediaAsset } from "@/types/assets";
import { cn } from "@/utils/ui";
import {
	AlertCircleIcon,
	Copy01Icon,
	Image02Icon,
	MusicNote03Icon,
	Search01Icon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const EXAMPLE_QUERIES = [
	"person talking",
	"outdoor shot",
	"close-up face",
	"screen recording",
	"landscape",
	"product shot",
];

export function VisualSearchView() {
	const editor = useEditor();
	const {
		hits,
		isSearching,
		error,
		indexedCount,
		indexing,
		hasIndex,
		debouncedSearch,
		findSimilar,
		refreshIndex,
	} = useVisualSearch();
	const [query, setQuery] = useState("");
	const [duplicates, setDuplicates] = useState<DuplicatePair[] | null>(null);
	const consumeFindSimilar = useSearchStore((s) => s.consumeFindSimilar);
	const pendingSimilar = useSearchStore((s) => s.pendingFindSimilarMediaId);
	const assets = editor.media.getAssets();
	const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

	// React to "find similar" triggered from the action system / context menu.
	useEffect(() => {
		if (!pendingSimilar) return;
		const id = consumeFindSimilar();
		if (!id) return;
		setQuery("");
		findSimilar(id).catch((err) => {
			toast.error(err instanceof Error ? err.message : "Find similar failed");
		});
	}, [pendingSimilar, consumeFindSimilar, findSimilar]);

	useEffect(() => {
		const cancel = debouncedSearch(query);
		return cancel;
	}, [query, debouncedSearch]);

	const handleFindDuplicates = useCallback(async () => {
		try {
			const pairs = await findDuplicates();
			setDuplicates(pairs);
			if (pairs.length === 0) {
				toast.success("No duplicates detected");
			} else {
				toast.info(
					`Found ${pairs.length} possible duplicate pair${pairs.length === 1 ? "" : "s"}`,
				);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Duplicate scan failed");
		}
	}, []);

	const inflightCount = Object.keys(indexing).length;

	const addElementAtTime = useCallback(
		(asset: MediaAsset, startTime: number) => {
			const duration =
				asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
			const element = buildElementFromMedia({
				mediaId: asset.id,
				mediaType: asset.type,
				name: asset.name,
				duration,
				startTime,
			});
			editor.timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
		},
		[editor.timeline],
	);

	const handleReindex = useCallback(async () => {
		try {
			await refreshIndex();
			toast.success("Search index refreshed");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to refresh search index",
			);
		}
	}, [refreshIndex]);

	return (
		<PanelView
			title="Visual Search"
			actions={
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={handleReindex}
								disabled={isSearching}
							>
								<HugeiconsIcon icon={Search01Icon} className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh search index</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={handleFindDuplicates}
								disabled={!hasIndex || isSearching}
							>
								<HugeiconsIcon icon={Copy01Icon} className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Find duplicate / retake clips</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			}
		>
			<div className="space-y-3 px-1">
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
					/>
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search footage by meaning..."
						className="pl-8"
						disabled={!hasIndex && inflightCount === 0}
					/>
				</div>

				{inflightCount > 0 && (
					<div className="bg-muted/40 text-muted-foreground rounded-md px-3 py-2 text-xs">
						Indexing {inflightCount} new asset
						{inflightCount > 1 ? "s" : ""}…{" "}
						<span className="text-foreground/70">({indexedCount} indexed)</span>
					</div>
				)}

				{!hasIndex && inflightCount === 0 && (
					<EmptyState
						title="No media indexed yet"
						body="Import a video or image to enable semantic search. OpenCut AI samples frames and embeds them locally — your footage never leaves the machine."
					/>
				)}

				{hasIndex && !query && hits.length === 0 && !isSearching && (
					<SuggestionRow
						label="Try"
						suggestions={EXAMPLE_QUERIES}
						onPick={setQuery}
					/>
				)}

				{error && (
					<div className="text-destructive flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs">
						<HugeiconsIcon
							icon={AlertCircleIcon}
							className="mt-0.5 size-4 shrink-0"
						/>
						<span>{error}</span>
					</div>
				)}

				{isSearching && (
					<div className="text-muted-foreground px-1 py-2 text-xs">
						Searching {indexedCount} indexed asset
						{indexedCount === 1 ? "" : "s"}…
					</div>
				)}

				{!isSearching && hits.length > 0 && (
					<div className="grid grid-cols-2 gap-2 pb-4">
						{hits.map((hit) => {
							const asset = byId.get(hit.mediaId);
							if (!asset) return null;
							return (
								<DraggableItem
									key={`${hit.mediaId}-${hit.timestampSec}`}
									name={asset.name}
									preview={
										asset.thumbnailUrl ? (
											// biome-ignore lint/performance/noImgElement: thumbnails are blob/object URLs, which next/image does not support
											<img
												src={asset.thumbnailUrl}
												alt={asset.name}
												className="size-full object-cover"
											/>
										) : (
											<TypeFallback type={asset.type} />
										)
									}
									dragData={{
										id: asset.id,
										type: "media",
										mediaType: asset.type,
										name: asset.name,
										...(asset.type !== "audio" && {
											targetElementTypes: ["video", "image"] as const,
										}),
									}}
									shouldShowPlusOnDrag={false}
									onAddToTimeline={({ currentTime }) =>
										addElementAtTime(asset, currentTime)
									}
									variant="card"
								/>
							);
						})}
					</div>
				)}

				{!isSearching && query.length >= 2 && hits.length === 0 && hasIndex && (
					<EmptyState
						title="No matches"
						body="Try a more general phrase, or import more footage. The index covers what's in your media bin."
					/>
				)}

				{duplicates && duplicates.length > 0 && (
					<div className="space-y-2 pb-4">
						<p className="text-muted-foreground px-1 text-xs font-medium">
							Possible duplicates ({duplicates.length})
						</p>
						{duplicates.map((pair) => {
							const a = byId.get(pair.mediaIdA);
							const b = byId.get(pair.mediaIdB);
							if (!a || !b) return null;
							return (
								<button
									key={`${pair.mediaIdA}-${pair.mediaIdB}`}
									type="button"
									className={cn(
										"hover:bg-accent flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs",
									)}
									onClick={() => {
										toast.info(
											`"${a.name}" and "${b.name}" look very similar (${Math.round(pair.score * 100)}%)`,
										);
									}}
								>
									<span className="flex-1 truncate">
										{a.name} ↔ {b.name}
									</span>
									<span className="text-muted-foreground">
										{Math.round(pair.score * 100)}%
									</span>
								</button>
							);
						})}
					</div>
				)}
			</div>
		</PanelView>
	);
}

function EmptyState({ title, body }: { title: string; body: string }) {
	return (
		<div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center">
			<HugeiconsIcon icon={Search01Icon} className="size-6 opacity-40" />
			<p className="text-foreground text-sm font-medium">{title}</p>
			<p className="text-xs">{body}</p>
		</div>
	);
}

function SuggestionRow({
	label,
	suggestions,
	onPick,
}: {
	label: string;
	suggestions: readonly string[];
	onPick: (value: string) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-muted-foreground text-xs">{label}</span>
			{suggestions.map((s) => (
				<button
					key={s}
					type="button"
					onClick={() => onPick(s)}
					className={cn(
						"hover:bg-accent rounded-full border px-2.5 py-0.5 text-xs transition-colors",
					)}
				>
					{s}
				</button>
			))}
		</div>
	);
}

function TypeFallback({ type }: { type: MediaAsset["type"] }) {
	const icon =
		type === "video"
			? Video01Icon
			: type === "audio"
				? MusicNote03Icon
				: Image02Icon;
	return (
		<div className="bg-muted flex size-full items-center justify-center">
			<HugeiconsIcon icon={icon} className="text-muted-foreground size-6" />
		</div>
	);
}
