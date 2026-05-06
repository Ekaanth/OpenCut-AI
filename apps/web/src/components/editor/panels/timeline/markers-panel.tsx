"use client";

import { useCallback, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Bookmark01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import type { Marker, MarkerColor } from "@/types/timeline";

const MARKER_COLORS: { color: MarkerColor; className: string }[] = [
	{ color: "red", className: "bg-red-500" },
	{ color: "yellow", className: "bg-yellow-500" },
	{ color: "green", className: "bg-green-500" },
	{ color: "blue", className: "bg-blue-500" },
	{ color: "purple", className: "bg-purple-500" },
];

export function MarkersPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const markers = editor.scenes.getMarkers();
	const currentTime = editor.playback.getCurrentTime();
	const [editingId, setEditingId] = useState<string | null>(null);

	const handleAdd = useCallback(() => {
		editor.scenes.addMarker({ time: currentTime, color: "red" });
	}, [editor, currentTime]);

	const handleSeek = useCallback(
		(time: number) => {
			editor.playback.seek({ time });
		},
		[editor],
	);

	const handleRemove = useCallback(
		(id: string) => {
			editor.scenes.removeMarker({ markerId: id });
		},
		[editor],
	);

	const handleColorChange = useCallback(
		(id: string, color: MarkerColor) => {
			editor.scenes.updateMarker({ markerId: id, updates: { color } });
		},
		[editor],
	);

	const handleNoteChange = useCallback(
		(id: string, note: string) => {
			editor.scenes.updateMarker({ markerId: id, updates: { note } });
		},
		[editor],
	);

	const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-3 py-2 border-b flex items-center justify-between">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Bookmark01Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">
						Markers ({markers.length})
					</span>
				</div>
				<Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleAdd}>
					Add
				</Button>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-3 py-2 space-y-1">
					{sortedMarkers.length === 0 && (
						<p className="text-[10px] text-muted-foreground text-center py-4">
							Press M to add a marker at the playhead
						</p>
					)}
					{sortedMarkers.map((marker) => (
						<MarkerItem
							key={marker.id}
							marker={marker}
							isEditing={editingId === marker.id}
							onSeek={() => handleSeek(marker.time)}
							onRemove={() => handleRemove(marker.id)}
							onColorChange={(color) => handleColorChange(marker.id, color)}
							onNoteChange={(note) => handleNoteChange(marker.id, note)}
							onStartEdit={() => setEditingId(marker.id)}
							onStopEdit={() => setEditingId(null)}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function MarkerItem({
	marker,
	isEditing,
	onSeek,
	onRemove,
	onColorChange,
	onNoteChange,
	onStartEdit,
	onStopEdit,
}: {
	marker: Marker;
	isEditing: boolean;
	onSeek: () => void;
	onRemove: () => void;
	onColorChange: (color: MarkerColor) => void;
	onNoteChange: (note: string) => void;
	onStartEdit: () => void;
	onStopEdit: () => void;
}) {
	const mins = Math.floor(marker.time / 60);
	const secs = (marker.time % 60).toFixed(1);
	const timeStr = `${mins}:${secs.padStart(4, "0")}`;

	return (
		<div className="rounded border p-2 space-y-1.5 hover:bg-accent/50 transition-colors">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onSeek}
					className="text-[10px] font-mono text-primary hover:underline"
				>
					{timeStr}
				</button>
				<div className="flex-1" />
				<div className="flex gap-0.5">
					{MARKER_COLORS.map(({ color, className }) => (
						<button
							key={color}
							type="button"
							className={cn(
								"size-3 rounded-full border",
								className,
								marker.color === color ? "ring-1 ring-primary" : "opacity-50",
							)}
							onClick={() => onColorChange(color)}
						/>
					))}
				</div>
				<button
					type="button"
					onClick={onRemove}
					className="text-muted-foreground hover:text-destructive"
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
				</button>
			</div>
			{isEditing ? (
				<input
					autoFocus
					className="w-full text-xs bg-transparent border-b border-primary outline-none"
					value={marker.note ?? ""}
					onChange={(e) => onNoteChange(e.target.value)}
					onBlur={onStopEdit}
					onKeyDown={(e) => {
						if (e.key === "Enter") onStopEdit();
					}}
					placeholder="Add a note..."
				/>
			) : (
				<p
					className="text-[10px] text-muted-foreground cursor-pointer truncate"
					onClick={onStartEdit}
				>
					{marker.note || "Click to add note..."}
				</p>
			)}
		</div>
	);
}
