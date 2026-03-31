"use client";

import { useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import type { Branch } from "@/types/version";

/**
 * Persistent version control bar shown in the editor header.
 * Provides: branch switcher, dirty indicator, quick commit, and drawer toggle.
 */
export function VersionControlBar({
	onOpenDrawer,
}: {
	onOpenDrawer: () => void;
}) {
	const editor = useEditor();
	const {
		currentBranch,
		isDirty,
		isCommitting,
		initialized,
		setCommits,
		setIsLoading,
		setInitialized,
		setIsCommitting,
		syncStatus,
		openCommitDialog,
	} = useVersionStore();

	// ─── Init version control on mount ────────────────────────────────────
	useEffect(() => {
		const project = editor.project.getActiveOrNull();
		if (!project || initialized) return;

		const init = async () => {
			setIsLoading(true);
			try {
				await editor.version.initialize(project.metadata.id);
				const commits = await editor.version.getLog();
				setCommits(commits);
				syncStatus(editor.version.status());
				setInitialized(true);
			} catch (err) {
				console.error("Failed to initialize version control:", err);
			} finally {
				setIsLoading(false);
			}
		};
		init();
	}, [editor, initialized, setCommits, setInitialized, setIsLoading, syncStatus]);

	// Subscribe to status changes
	useEffect(() => {
		if (!initialized) return;
		return editor.version.subscribeStatus(() => {
			syncStatus(editor.version.status());
		});
	}, [editor.version, initialized, syncStatus]);

	// Subscribe to new commits
	useEffect(() => {
		if (!initialized) return;
		return editor.version.onCommit(async () => {
			const commits = await editor.version.getLog();
			setCommits(commits);
		});
	}, [editor.version, initialized, setCommits]);

	// ─── Quick commit (no dialog) ─────────────────────────────────────────
	const handleQuickCommit = useCallback(async () => {
		if (!isDirty || isCommitting) return;
		setIsCommitting(true);
		try {
			await editor.version.commit("Quick save");
			const commits = await editor.version.getLog();
			setCommits(commits);
			syncStatus(editor.version.status());
		} catch (err) {
			console.error("Quick commit failed:", err);
		} finally {
			setIsCommitting(false);
		}
	}, [isDirty, isCommitting, editor.version, setCommits, syncStatus, setIsCommitting]);

	if (!initialized) return null;

	return (
		<div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5">
			{/* Branch switcher */}
			<BranchButton />

			<Separator orientation="vertical" className="h-4" />

			{/* Dirty indicator + commit */}
			{isDirty ? (
				<>
					<span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
					<button
						type="button"
						className="text-[11px] text-yellow-500/90 hover:text-yellow-400 font-medium px-1 transition-colors"
						onClick={() => openCommitDialog()}
						title="Commit changes (Ctrl+Shift+S)"
					>
						{isCommitting ? "Saving..." : "Commit"}
					</button>
					<button
						type="button"
						className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground px-0.5 transition-colors"
						onClick={handleQuickCommit}
						title="Quick save without message"
					>
						Quick
					</button>
				</>
			) : (
				<span className="text-[11px] text-muted-foreground/50 px-1">Clean</span>
			)}

			<Separator orientation="vertical" className="h-4" />

			{/* Open full panel */}
			<button
				type="button"
				className="text-[11px] text-muted-foreground hover:text-foreground px-1 transition-colors flex items-center gap-1"
				onClick={onOpenDrawer}
				title="Open version control panel"
			>
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
					<path d="M5 3v6.5a3.5 3.5 0 1 0 3 3.46V3M11 3v3.5a3.5 3.5 0 0 1-3 3.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="5" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
					<circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
					<circle cx="5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" />
				</svg>
				History
			</button>
		</div>
	);
}

// ─── Inline Branch Switcher ───────────────────────────────────────────────

function BranchButton() {
	const editor = useEditor();
	const { currentBranch, isDirty, initialized, setCommits, syncStatus } =
		useVersionStore();

	const [open, setOpen] = useState(false);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [switching, setSwitching] = useState(false);

	useEffect(() => {
		if (!open || !initialized) return;
		editor.version.listBranches().then(setBranches);
	}, [open, initialized, editor.version]);

	const handleSwitch = useCallback(
		async (name: string) => {
			if (name === currentBranch) {
				setOpen(false);
				return;
			}
			if (isDirty) {
				const ok = window.confirm(
					"You have uncommitted changes. Switching branches will discard them. Continue?",
				);
				if (!ok) return;
			}
			setSwitching(true);
			try {
				await editor.version.switchBranch(name);
				const commits = await editor.version.getLog();
				setCommits(commits);
				syncStatus(editor.version.status());
				setOpen(false);
			} catch (err) {
				console.error("Branch switch failed:", err);
			} finally {
				setSwitching(false);
			}
		},
		[currentBranch, isDirty, editor.version, setCommits, syncStatus],
	);

	const handleCreate = useCallback(async () => {
		if (!newName.trim()) return;
		try {
			await editor.version.createBranch(newName.trim());
			await handleSwitch(newName.trim());
			setCreating(false);
			setNewName("");
		} catch (err) {
			console.error("Create branch failed:", err);
		}
	}, [newName, editor.version, handleSwitch]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-1 transition-colors"
					title="Switch branch"
				>
					<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
						<path d="M5 3v8M11 3v3.5a3.5 3.5 0 0 1-3 3.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					{currentBranch}
					<svg width="8" height="8" viewBox="0 0 16 16" fill="none" className="opacity-50">
						<path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-52 p-0" align="start">
				<div className="py-1 max-h-48 overflow-y-auto">
					{branches.map((b) => (
						<button
							key={b.id}
							type="button"
							className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center justify-between ${
								b.name === currentBranch ? "text-primary font-medium" : "text-foreground/80"
							}`}
							onClick={() => handleSwitch(b.name)}
							disabled={switching}
						>
							<span className="truncate">{b.name}</span>
							{b.name === currentBranch && (
								<span className="text-primary text-[10px]">current</span>
							)}
						</button>
					))}
				</div>
				<Separator />
				{creating ? (
					<div className="p-2 flex gap-1">
						<Input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreate();
								if (e.key === "Escape") setCreating(false);
							}}
							placeholder="branch-name"
							className="h-7 text-xs"
							autoFocus
						/>
						<Button size="sm" className="h-7 text-xs px-2" onClick={handleCreate}>
							Create
						</Button>
					</div>
				) : (
					<button
						type="button"
						className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						onClick={() => setCreating(true)}
					>
						+ New branch
					</button>
				)}
			</PopoverContent>
		</Popover>
	);
}
