"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { SyncState, SyncEngine } from "@/services/sync/sync-engine";

const STATUS_CONFIG: Record<
	SyncState["status"],
	{ label: string; icon: string; color: string }
> = {
	idle: { label: "Not synced", icon: "—", color: "text-muted-foreground" },
	syncing: { label: "Syncing...", icon: "↻", color: "text-blue-400" },
	synced: { label: "Synced", icon: "✓", color: "text-green-400" },
	unsynced: { label: "Unsynced", icon: "↑", color: "text-yellow-400" },
	offline: { label: "Offline", icon: "⊘", color: "text-muted-foreground/60" },
	error: { label: "Sync error", icon: "!", color: "text-red-400" },
};

export function SyncStatusIndicator({
	syncEngine,
}: {
	syncEngine: SyncEngine | null;
}) {
	const [state, setState] = useState<SyncState>({
		status: "idle",
		lastSyncAt: null,
		commitsAhead: 0,
		commitsBehind: 0,
		error: null,
	});

	useEffect(() => {
		if (!syncEngine) return;
		setState(syncEngine.getState());
		return syncEngine.subscribe(setState);
	}, [syncEngine]);

	const handleSync = useCallback(async () => {
		if (!syncEngine) return;
		try {
			await syncEngine.sync();
		} catch {
			// Error already captured in state
		}
	}, [syncEngine]);

	const handlePush = useCallback(async () => {
		if (!syncEngine) return;
		try {
			await syncEngine.push();
		} catch {}
	}, [syncEngine]);

	const handlePull = useCallback(async () => {
		if (!syncEngine) return;
		try {
			await syncEngine.pull();
		} catch {}
	}, [syncEngine]);

	if (!syncEngine || !syncEngine.getRepoId()) {
		return null;
	}

	const config = STATUS_CONFIG[state.status];

	return (
		<div className="flex items-center gap-2">
			{/* Status indicator */}
			<div className={`flex items-center gap-1 text-xs ${config.color}`}>
				<span className={state.status === "syncing" ? "animate-spin" : ""}>
					{config.icon}
				</span>
				<span>{config.label}</span>
			</div>

			{/* Ahead/behind badges */}
			{state.commitsAhead > 0 && (
				<span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
					↑{state.commitsAhead}
				</span>
			)}
			{state.commitsBehind > 0 && (
				<span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">
					↓{state.commitsBehind}
				</span>
			)}

			{/* Sync buttons */}
			<div className="flex gap-1">
				<button
					type="button"
					className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
					onClick={handlePush}
					disabled={state.status === "syncing"}
					title="Push local commits to server"
				>
					Push
				</button>
				<button
					type="button"
					className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
					onClick={handlePull}
					disabled={state.status === "syncing"}
					title="Pull remote commits to local"
				>
					Pull
				</button>
				<button
					type="button"
					className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
					onClick={handleSync}
					disabled={state.status === "syncing"}
					title="Push + Pull"
				>
					Sync
				</button>
			</div>

			{/* Error tooltip */}
			{state.error && (
				<span className="text-[10px] text-red-400" title={state.error}>
					{state.error.slice(0, 30)}
				</span>
			)}
		</div>
	);
}
