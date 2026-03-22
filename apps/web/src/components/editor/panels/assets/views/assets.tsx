"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { MediaDragOverlay } from "@/components/editor/panels/assets/drag-overlay";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEditor } from "@/hooks/use-editor";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRevealItem } from "@/hooks/use-reveal-item";
import { processMediaAssets } from "@/lib/media/processing";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import {
	type MediaSortKey,
	type MediaSortOrder,
	type MediaTypeFilter,
	type MediaViewMode,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";
import type { MediaAsset } from "@/types/assets";
import { cn } from "@/utils/ui";
import {
	CloudUploadIcon,
	GridViewIcon,
	LeftToRightListDashIcon,
	SortingOneNineIcon,
	Image02Icon,
	MusicNote03Icon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export function MediaView() {
	const editor = useEditor();
	const mediaFiles = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const {
		mediaViewMode,
		setMediaViewMode,
		highlightMediaId,
		clearHighlight,
		mediaSortBy,
		mediaSortOrder,
		setMediaSort,
		mediaTypeFilter,
		setMediaTypeFilter,
	} = useAssetsPanelStore();
	const { highlightedId, registerElement } = useRevealItem(
		highlightMediaId,
		clearHighlight,
	);

	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);

	const processFiles = async ({ files }: { files: FileList }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			const processedAssets = await processMediaAssets({
				files,
				onProgress: (progress: { progress: number }) =>
					setProgress(progress.progress),
			});
			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
		} catch (error) {
			console.error("Error processing files:", error);
			toast.error("Failed to process files");
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const { isDragOver, dragProps, openFilePicker, fileInputProps } =
		useFileUpload({
			accept: "image/*,video/*,audio/*",
			multiple: true,
			onFilesSelected: (files) => processFiles({ files }),
		});

	const handleRemove = async ({
		event,
		id,
	}: {
		event: React.MouseEvent;
		id: string;
	}) => {
		event.stopPropagation();

		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		await editor.media.removeMediaAsset({
			projectId: activeProject.metadata.id,
			id,
		});
	};

	const handleSort = ({ key }: { key: MediaSortKey }) => {
		if (mediaSortBy === key) {
			setMediaSort(key, mediaSortOrder === "asc" ? "desc" : "asc");
		} else {
			setMediaSort(key, "asc");
		}
	};

	const nonEphemeralMedia = useMemo(
		() => mediaFiles.filter((item) => !item.ephemeral),
		[mediaFiles],
	);

	const typeCounts = useMemo(() => {
		const counts = { all: 0, video: 0, image: 0, audio: 0 };
		for (const item of nonEphemeralMedia) {
			counts.all++;
			if (item.type === "video") counts.video++;
			else if (item.type === "image") counts.image++;
			else if (item.type === "audio") counts.audio++;
		}
		return counts;
	}, [nonEphemeralMedia]);

	const filteredMediaItems = useMemo(() => {
		const filtered = mediaTypeFilter === "all"
			? nonEphemeralMedia
			: nonEphemeralMedia.filter((item) => item.type === mediaTypeFilter);

		const sorted = [...filtered];
		sorted.sort((a, b) => {
			let valueA: string | number;
			let valueB: string | number;

			switch (mediaSortBy) {
				case "name":
					valueA = a.name.toLowerCase();
					valueB = b.name.toLowerCase();
					break;
				case "type":
					valueA = a.type;
					valueB = b.type;
					break;
				case "duration":
					valueA = a.duration || 0;
					valueB = b.duration || 0;
					break;
				case "size":
					valueA = a.file.size;
					valueB = b.file.size;
					break;
				default:
					return 0;
			}

			if (valueA < valueB) return mediaSortOrder === "asc" ? -1 : 1;
			if (valueA > valueB) return mediaSortOrder === "asc" ? 1 : -1;
			return 0;
		});

		return sorted;
	}, [nonEphemeralMedia, mediaTypeFilter, mediaSortBy, mediaSortOrder]);

	return (
		<>
			<input {...fileInputProps} />

			<PanelView
				title="Assets"
				actions={
					<MediaActions
						mediaViewMode={mediaViewMode}
						setMediaViewMode={setMediaViewMode}
						isProcessing={isProcessing}
						sortBy={mediaSortBy}
						sortOrder={mediaSortOrder}
						onSort={handleSort}
						onImport={openFilePicker}
					/>
				}
				className={cn(isDragOver && "bg-accent/30")}
				{...dragProps}
			>
				{/* Type filter tabs */}
				{nonEphemeralMedia.length > 0 && !isDragOver && (
					<MediaTypeFilterBar
						filter={mediaTypeFilter}
						onFilterChange={setMediaTypeFilter}
						counts={typeCounts}
					/>
				)}

				{isDragOver || filteredMediaItems.length === 0 ? (
					<MediaDragOverlay
						isVisible={true}
						isProcessing={isProcessing}
						progress={progress}
						onClick={openFilePicker}
					/>
				) : (
					<MediaItemList
						items={filteredMediaItems}
						mode={mediaViewMode}
						onRemove={handleRemove}
						highlightedId={highlightedId}
						registerElement={registerElement}
					/>
				)}
			</PanelView>
		</>
	);
}

function MediaAssetDraggable({
	item,
	preview,
	isHighlighted,
	variant,
	isRounded,
}: {
	item: MediaAsset;
	preview: React.ReactNode;
	isHighlighted: boolean;
	variant: "card" | "compact";
	isRounded?: boolean;
}) {
	const editor = useEditor();

	const addElementAtTime = ({
		asset,
		startTime,
	}: {
		asset: MediaAsset;
		startTime: number;
	}) => {
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
	};

	return (
		<DraggableItem
			name={item.name}
			preview={preview}
			dragData={{
				id: item.id,
				type: "media",
				mediaType: item.type,
				name: item.name,
				...(item.type !== "audio" && {
					targetElementTypes: ["video", "image"] as const,
				}),
			}}
			shouldShowPlusOnDrag={false}
			onAddToTimeline={({ currentTime }) =>
				addElementAtTime({ asset: item, startTime: currentTime })
			}
			variant={variant}
			isRounded={isRounded}
			isHighlighted={isHighlighted}
		/>
	);
}

function MediaItemWithContextMenu({
	item,
	children,
	onRemove,
	onSetLabel,
}: {
	item: MediaAsset;
	children: React.ReactNode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
	onSetLabel: (id: string) => void;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onClick={() => onSetLabel(item.id)}>
					{item.label ? "Edit label" : "Add label"}
				</ContextMenuItem>
				<ContextMenuItem>Export clips</ContextMenuItem>
				<ContextMenuItem
					variant="destructive"
					onClick={(event) => onRemove({ event, id: item.id })}
				>
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function MediaItemList({
	items,
	mode,
	onRemove,
	highlightedId,
	registerElement,
}: {
	items: MediaAsset[];
	mode: MediaViewMode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
	highlightedId: string | null;
	registerElement: (id: string, element: HTMLElement | null) => void;
}) {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const isGrid = mode === "grid";

	const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
	const [labelDraft, setLabelDraft] = useState("");

	const handleStartLabelEdit = (id: string) => {
		const asset = items.find((i) => i.id === id);
		setLabelDraft(asset?.label ?? "");
		setEditingLabelId(id);
	};

	const handleSaveLabel = async () => {
		if (!editingLabelId || !activeProject) return;
		const trimmed = labelDraft.trim();
		await editor.media.updateMediaAsset({
			projectId: activeProject.metadata.id,
			id: editingLabelId,
			updates: { label: trimmed || undefined },
		});
		setEditingLabelId(null);
	};

	const handleLabelKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSaveLabel();
		} else if (e.key === "Escape") {
			setEditingLabelId(null);
		}
	};

	return (
		<div
			className={cn(isGrid ? "grid gap-2" : "flex flex-col gap-1")}
			style={
				isGrid ? { gridTemplateColumns: "repeat(auto-fill, 160px)" } : undefined
			}
		>
			{items.map((item) => (
				<div key={item.id} ref={(element) => registerElement(item.id, element)}>
					<MediaItemWithContextMenu
						item={item}
						onRemove={onRemove}
						onSetLabel={handleStartLabelEdit}
					>
						<div className={isGrid ? "flex flex-col" : "flex items-center"}>
							<MediaAssetDraggable
								item={item}
								preview={
									<MediaPreview
										item={item}
										variant={isGrid ? "grid" : "compact"}
									/>
								}
								variant={isGrid ? "card" : "compact"}
								isRounded={isGrid ? false : undefined}
								isHighlighted={highlightedId === item.id}
							/>
							{/* Label display / edit */}
							<MediaLabelRow
								item={item}
								isEditing={editingLabelId === item.id}
								draft={labelDraft}
								onDraftChange={setLabelDraft}
								onStartEdit={() => handleStartLabelEdit(item.id)}
								onSave={handleSaveLabel}
								onKeyDown={handleLabelKeyDown}
								compact={!isGrid}
							/>
						</div>
					</MediaItemWithContextMenu>
				</div>
			))}
		</div>
	);
}

function MediaLabelRow({
	item,
	isEditing,
	draft,
	onDraftChange,
	onStartEdit,
	onSave,
	onKeyDown,
	compact = false,
}: {
	item: MediaAsset;
	isEditing: boolean;
	draft: string;
	onDraftChange: (v: string) => void;
	onStartEdit: () => void;
	onSave: () => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	compact?: boolean;
}) {
	if (isEditing) {
		return (
			<input
				autoFocus
				type="text"
				value={draft}
				onChange={(e) => onDraftChange(e.target.value)}
				onBlur={onSave}
				onKeyDown={onKeyDown}
				placeholder="e.g. Drone shot, Cam A"
				className={cn(
					"w-full rounded border bg-transparent outline-none focus:ring-1 focus:ring-ring",
					compact ? "h-5 px-1 text-[9px]" : "mt-0.5 px-1 py-0.5 text-[10px]",
				)}
			/>
		);
	}

	if (item.label) {
		return (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onStartEdit();
				}}
				className={cn(
					"truncate rounded text-left font-medium text-muted-foreground hover:bg-muted",
					compact
						? "ml-1 shrink-0 bg-muted/40 px-1.5 py-0.5 text-[9px]"
						: "mt-0.5 w-full bg-muted/60 px-1 py-0.5 text-[10px]",
				)}
				title={`Label: ${item.label} (click to edit)`}
			>
				{item.label}
			</button>
		);
	}

	// In compact (list) view, hide the "add" button to keep it clean
	if (compact) return null;

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onStartEdit();
			}}
			className="mt-0.5 w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted/40"
		>
			+ Add label
		</button>
	);
}

export function formatDuration({ duration }: { duration: number }) {
	const min = Math.floor(duration / 60);
	const sec = Math.floor(duration % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function MediaDurationBadge({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
			{formatDuration({ duration })}
		</div>
	);
}

function MediaDurationLabel({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<span className="text-xs opacity-70">{formatDuration({ duration })}</span>
	);
}

function MediaTypePlaceholder({
	icon,
	label,
	duration,
	variant,
}: {
	icon: IconSvgElement;
	label: string;
	duration?: number;
	variant: "muted" | "bordered";
}) {
	const iconClassName = cn("size-6", variant === "bordered" && "mb-1");

	return (
		<div
			className={cn(
				"text-muted-foreground flex size-full flex-col items-center justify-center rounded",
				variant === "muted" ? "bg-muted/30" : "border",
			)}
		>
			<HugeiconsIcon icon={icon} className={iconClassName} />
			<span className="text-xs">{label}</span>
			<MediaDurationLabel duration={duration} />
		</div>
	);
}

function MediaPreview({
	item,
	variant = "grid",
}: {
	item: MediaAsset;
	variant?: "grid" | "compact";
}) {
	const shouldShowDurationBadge = variant === "grid";

	if (item.type === "image") {
		return (
			<div className="relative flex size-full items-center justify-center">
				<Image
					src={item.url ?? ""}
					alt={item.name}
					fill
					sizes="100vw"
					className="object-cover"
					loading="lazy"
					unoptimized
				/>
				{shouldShowDurationBadge && (
					<MediaTypeBadge type="image" />
				)}
			</div>
		);
	}

	if (item.type === "video") {
		if (item.thumbnailUrl) {
			return (
				<div className="relative size-full">
					<Image
						src={item.thumbnailUrl}
						alt={item.name}
						fill
						sizes="100vw"
						className="rounded object-cover"
						loading="lazy"
						unoptimized
					/>
					{shouldShowDurationBadge && (
						<>
							<MediaTypeBadge type="video" />
							<MediaDurationBadge duration={item.duration} />
						</>
					)}
				</div>
			);
		}

		return (
			<MediaTypePlaceholder
				icon={Video01Icon}
				label="Video"
				duration={item.duration}
				variant="muted"
			/>
		);
	}

	if (item.type === "audio") {
		return (
			<MediaTypePlaceholder
				icon={MusicNote03Icon}
				label="Audio"
				duration={item.duration}
				variant="bordered"
			/>
		);
	}

	return (
		<MediaTypePlaceholder icon={Image02Icon} label="Unknown" variant="muted" />
	);
}

function MediaActions({
	mediaViewMode,
	setMediaViewMode,
	isProcessing,
	sortBy,
	sortOrder,
	onSort,
	onImport,
}: {
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	isProcessing: boolean;
	sortBy: MediaSortKey;
	sortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
	onImport: () => void;
}) {
	return (
		<div className="flex gap-1.5">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							onClick={() =>
								setMediaViewMode(mediaViewMode === "grid" ? "list" : "grid")
							}
							disabled={isProcessing}
							className="items-center justify-center"
						>
							{mediaViewMode === "grid" ? (
								<HugeiconsIcon icon={LeftToRightListDashIcon} />
							) : (
								<HugeiconsIcon icon={GridViewIcon} />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>
							{mediaViewMode === "grid"
								? "Switch to list view"
								: "Switch to grid view"}
						</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<DropdownMenu>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									disabled={isProcessing}
									className="items-center justify-center"
								>
									<HugeiconsIcon icon={SortingOneNineIcon} />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<DropdownMenuContent align="end">
							<SortMenuItem
								label="Name"
								sortKey="name"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Type"
								sortKey="type"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Duration"
								sortKey="duration"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="File size"
								sortKey="size"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<TooltipContent>
						<p>
							Sort by {sortBy} (
							{sortOrder === "asc" ? "ascending" : "descending"})
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<Button
				variant="outline"
				onClick={onImport}
				disabled={isProcessing}
				size="sm"
				className="items-center justify-center gap-1.5"
			>
				<HugeiconsIcon icon={CloudUploadIcon} />
				Import
			</Button>
		</div>
	);
}

function SortMenuItem({
	label,
	sortKey,
	currentSortBy,
	currentSortOrder,
	onSort,
}: {
	label: string;
	sortKey: MediaSortKey;
	currentSortBy: MediaSortKey;
	currentSortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
}) {
	const isActive = currentSortBy === sortKey;
	const arrow = isActive ? (currentSortOrder === "asc" ? "↑" : "↓") : "";

	return (
		<DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
			{label} {arrow}
		</DropdownMenuItem>
	);
}

const TYPE_BADGE_STYLES: Record<string, string> = {
	video: "bg-blue-500/80",
	image: "bg-emerald-500/80",
	audio: "bg-amber-500/80",
};

function MediaTypeBadge({ type }: { type: string }) {
	return (
		<div
			className={cn(
				"absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-medium uppercase leading-none text-white",
				TYPE_BADGE_STYLES[type] ?? "bg-black/60",
			)}
		>
			{type === "image" ? "IMG" : type === "video" ? "MP4" : type.toUpperCase()}
		</div>
	);
}

const FILTER_TABS: { key: MediaTypeFilter; label: string; icon: IconSvgElement }[] = [
	{ key: "all", label: "All", icon: GridViewIcon },
	{ key: "video", label: "Videos", icon: Video01Icon },
	{ key: "image", label: "Images", icon: Image02Icon },
	{ key: "audio", label: "Audio", icon: MusicNote03Icon },
];

function MediaTypeFilterBar({
	filter,
	onFilterChange,
	counts,
}: {
	filter: MediaTypeFilter;
	onFilterChange: (f: MediaTypeFilter) => void;
	counts: Record<MediaTypeFilter, number>;
}) {
	return (
		<div className="flex items-center gap-1 pb-3">
			{FILTER_TABS.map((tab) => {
				const isActive = filter === tab.key;
				const count = counts[tab.key];
				if (tab.key !== "all" && count === 0) return null;

				return (
					<button
						key={tab.key}
						type="button"
						onClick={() => onFilterChange(tab.key)}
						className={cn(
							"flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
							isActive
								? "bg-primary text-primary-foreground"
								: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						<HugeiconsIcon icon={tab.icon} className="size-3" />
						{tab.label}
						<span
							className={cn(
								"ml-0.5 text-[9px] tabular-nums",
								isActive ? "text-primary-foreground/70" : "text-muted-foreground/60",
							)}
						>
							{count}
						</span>
					</button>
				);
			})}
		</div>
	);
}
