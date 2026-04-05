"use client";

import { cn } from "@/utils/ui";
import { Badge } from "@/components/ui/badge";
import type { ScoredClipData } from "@/lib/ai-client";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

const GRADE_COLORS: Record<string, string> = {
	A: "bg-green-500/20 text-green-400 border-green-500/30",
	B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
	C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
	D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
	F: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface ClipCardProps {
	clip: ScoredClipData;
	selected: boolean;
	onToggle: () => void;
	onExpand: () => void;
}

export function ClipCard({ clip, selected, onToggle, onExpand }: ClipCardProps) {
	const grade = clip.engagement?.grade ?? "C";
	const composite = clip.engagement?.composite ?? 0;
	const duration = clip.end - clip.start;

	return (
		<div
			className={cn(
				"rounded-lg border p-3 space-y-2 cursor-pointer transition-colors",
				selected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
			)}
			onClick={onExpand}
		>
			{/* Header */}
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<input
						type="checkbox"
						checked={selected}
						onChange={(e) => {
							e.stopPropagation();
							onToggle();
						}}
						className="rounded flex-shrink-0"
					/>
					<span className="text-sm font-medium truncate">{clip.title}</span>
				</div>
				<Badge className={cn("text-xs flex-shrink-0 border", GRADE_COLORS[grade])}>
					{grade} {Math.round(composite)}
				</Badge>
			</div>

			{/* Details */}
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>{formatTime(clip.start)} - {formatTime(clip.end)}</span>
				<span>({Math.round(duration)}s)</span>
			</div>

			{/* Tags */}
			{clip.tags.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{clip.tags.slice(0, 3).map((tag) => (
						<Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
							{tag}
						</Badge>
					))}
				</div>
			)}

			{/* Transcript preview */}
			{clip.transcript_preview && (
				<p className="text-xs text-muted-foreground line-clamp-2">
					{clip.transcript_preview}
				</p>
			)}

			{/* Score bars */}
			{clip.engagement && (
				<div className="grid grid-cols-4 gap-1">
					{(["hook", "curiosity", "energy", "virality"] as const).map((key) => {
						const eng = clip.engagement!;
						const sub = eng[key];
						const val = sub?.composite ?? 0;
						return (
							<div key={key} className="space-y-0.5">
								<div className="h-1 w-full rounded-full bg-muted overflow-hidden">
									<div
										className={cn(
											"h-full rounded-full",
											val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-500" : "bg-red-500",
										)}
										style={{ width: `${val}%` }}
									/>
								</div>
								<span className="text-[9px] text-muted-foreground capitalize">{key}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
