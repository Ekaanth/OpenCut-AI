"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";

function formatTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * Tiny indicator that shows save status in the editor header.
 * Shows: "Saving..." / "Saved just now" / "Saved 2m ago"
 */
export function SaveStatus({ className }: { className?: string }) {
	const editor = useEditor();
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<number | null>(null);
	const [, setTick] = useState(0);

	// Subscribe to save status changes
	useEffect(() => {
		const update = () => {
			setIsSaving(editor.save.getIsSaving());
			setLastSaved(editor.save.getLastSavedAt());
		};
		update();
		return editor.save.subscribeStatus(update);
	}, [editor]);

	// Tick every 15s to update the "Xm ago" display
	useEffect(() => {
		const interval = setInterval(() => setTick((t) => t + 1), 15_000);
		return () => clearInterval(interval);
	}, []);

	// Warn before closing tab with unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (editor.save.getIsDirty()) {
				e.preventDefault();
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [editor]);

	if (isSaving) {
		return (
			<span className={cn("text-[10px] text-muted-foreground animate-pulse", className)}>
				Saving...
			</span>
		);
	}

	if (lastSaved) {
		return (
			<span className={cn("text-[10px] text-muted-foreground", className)}>
				Saved {formatTimeAgo(lastSaved)}
			</span>
		);
	}

	return null;
}
