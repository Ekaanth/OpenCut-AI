"use client";

import type { Commit } from "@/types/version";
import { useVersionStore } from "@/stores/version-store";

function formatRelativeTime(isoString: string): string {
	const date = new Date(isoString);
	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHr / 24);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay < 7) return `${diffDay}d ago`;
	return date.toLocaleDateString();
}

function formatChangeBadge(summary: Commit["changeSummary"]): string {
	const parts: string[] = [];
	if (summary.elementsAdded > 0) parts.push(`+${summary.elementsAdded}`);
	if (summary.elementsRemoved > 0) parts.push(`-${summary.elementsRemoved}`);
	if (summary.elementsModified > 0) parts.push(`~${summary.elementsModified}`);
	if (summary.tracksAdded > 0) parts.push(`+${summary.tracksAdded} tracks`);
	if (summary.tracksRemoved > 0) parts.push(`-${summary.tracksRemoved} tracks`);
	return parts.join(", ") || "No changes";
}

export function CommitItem({
	commit,
	isSelected,
	tags,
}: {
	commit: Commit;
	isSelected: boolean;
	tags?: string[];
}) {
	const { selectCommit } = useVersionStore();

	return (
		<button
			type="button"
			className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors cursor-pointer hover:bg-muted/50 ${
				isSelected
					? "border-l-primary bg-muted/40"
					: "border-l-transparent"
			} ${commit.isAutoCommit ? "opacity-60" : ""}`}
			onClick={() => selectCommit(isSelected ? null : commit.id)}
		>
			<div className="flex items-start justify-between gap-2">
				{/* Thumbnail */}
				{commit.thumbnailUrl && (
					<img
						src={commit.thumbnailUrl}
						alt=""
						className="w-12 h-7 rounded object-cover flex-shrink-0 border border-border/50"
					/>
				)}
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium truncate flex items-center gap-1">
						{commit.message.startsWith("Merge ") && (
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-purple-400">
								<path d="M5 3v6.5a3.5 3.5 0 1 0 3 3.46V3M11 3v3.5a3.5 3.5 0 0 1-3 3.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						)}
						{commit.message.startsWith("Cherry-pick:") && (
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-pink-400">
								<circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
								<path d="M8 9v4M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
							</svg>
						)}
						<span className="truncate">{commit.message}</span>
					</div>
					<div className="text-xs text-muted-foreground mt-0.5">
						{formatChangeBadge(commit.changeSummary)}
					</div>
				</div>
				<div className="text-xs text-muted-foreground/60 whitespace-nowrap">
					{formatRelativeTime(commit.timestamp)}
				</div>
			</div>

			{/* Tags */}
			{tags && tags.length > 0 && (
				<div className="flex gap-1 mt-1 flex-wrap">
					{tags.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
						>
							{tag}
						</span>
					))}
				</div>
			)}

			{/* Metadata row */}
			<div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
				{commit.authorInfo && (
					<span className="flex items-center gap-1">
						{commit.authorInfo.avatar ? (
							<img
								src={commit.authorInfo.avatar}
								alt=""
								className="w-3 h-3 rounded-full"
							/>
						) : null}
						<span>{commit.authorInfo.name}</span>
					</span>
				)}
				<span>{commit.trackCount} tracks</span>
				<span>{commit.elementCount} elements</span>
				{commit.duration > 0 && (
					<span>{commit.duration.toFixed(1)}s</span>
				)}
			</div>
		</button>
	);
}
