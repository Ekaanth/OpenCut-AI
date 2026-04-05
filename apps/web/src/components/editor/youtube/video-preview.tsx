"use client";

import type { YouTubeVideoMeta } from "@/lib/ai-client";
import { Badge } from "@/components/ui/badge";

function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

interface VideoPreviewProps {
	meta: YouTubeVideoMeta;
}

export function VideoPreview({ meta }: VideoPreviewProps) {
	return (
		<div className="flex gap-3 rounded-lg border bg-card p-3">
			{meta.thumbnail_url && (
				<img
					src={meta.thumbnail_url}
					alt={meta.title}
					className="h-20 w-36 rounded object-cover flex-shrink-0"
				/>
			)}
			<div className="min-w-0 flex-1 space-y-1">
				<h4 className="text-sm font-medium truncate">{meta.title}</h4>
				<p className="text-xs text-muted-foreground">{meta.channel_name}</p>
				<div className="flex items-center gap-2">
					<Badge variant="secondary" className="text-xs">
						{formatDuration(meta.duration_seconds)}
					</Badge>
					{meta.view_count != null && (
						<span className="text-xs text-muted-foreground">
							{meta.view_count.toLocaleString()} views
						</span>
					)}
					{meta.warning && (
						<Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
							{meta.warning}
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
}
