"use client";

import { useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import { CommitList } from "./commit-list";
import { CommitDialog } from "./commit-dialog";
import { BranchSwitcher } from "./branch-switcher";
import { DiffView } from "./diff-view";
import { BranchManager } from "./branch-manager";
import { TagManager } from "./tag-manager";
import { MergeDialog } from "./merge-dialog";

type PanelTab = "history" | "diff";

export function VersionHistoryPanel() {
	const editor = useEditor();
	const {
		currentBranch,
		isDirty,
		selectedCommitId,
		isRestoring,
		initialized,
		autoCommitEnabled,
		openCommitDialog,
		setIsRestoring,
		setCommits,
		setIsLoading,
		setInitialized,
		setAutoCommitEnabled,
		syncStatus,
		selectCommit,
	} = useVersionStore();

	const [activeTab, setActiveTab] = useState<PanelTab>("history");
	const [branchManagerOpen, setBranchManagerOpen] = useState(false);
	const [tagManagerOpen, setTagManagerOpen] = useState(false);
	const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

	// Initialize version control on mount
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

	// Subscribe to version manager status changes
	useEffect(() => {
		if (!initialized) return;
		return editor.version.subscribeStatus(() => {
			syncStatus(editor.version.status());
		});
	}, [editor.version, initialized, syncStatus]);

	// Subscribe to commits (including auto-commits)
	useEffect(() => {
		if (!initialized) return;
		return editor.version.onCommit(async () => {
			const commits = await editor.version.getLog();
			setCommits(commits);
		});
	}, [editor.version, initialized, setCommits]);

	const handleRestore = useCallback(async () => {
		if (!selectedCommitId) return;

		const confirmed = window.confirm(
			"This will replace your current timeline. Uncommitted changes will be lost. Continue?",
		);
		if (!confirmed) return;

		setIsRestoring(true);
		try {
			await editor.version.restoreToCommit(selectedCommitId);
			const commits = await editor.version.getLog();
			setCommits(commits);
			syncStatus(editor.version.status());
			selectCommit(null);
		} catch (err) {
			console.error("Restore failed:", err);
		} finally {
			setIsRestoring(false);
		}
	}, [selectedCommitId, editor.version, setIsRestoring, setCommits, syncStatus, selectCommit]);

	const handleToggleAutoCommit = useCallback(() => {
		const next = !autoCommitEnabled;
		setAutoCommitEnabled(next);
		editor.version.setAutoCommit(next);
	}, [autoCommitEnabled, setAutoCommitEnabled, editor.version]);

	return (
		<div className="flex flex-col h-full">
			{/* Header with branch switcher */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<div className="flex items-center gap-2">
					<BranchSwitcher />
				</div>
				<div className="flex items-center gap-1">
					{isDirty && (
						<span className="w-2 h-2 rounded-full bg-yellow-500" title="Uncommitted changes" />
					)}
					<button
						type="button"
						onClick={handleToggleAutoCommit}
						className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
							autoCommitEnabled
								? "bg-primary/10 text-primary"
								: "bg-muted text-muted-foreground hover:text-foreground"
						}`}
						title={autoCommitEnabled ? "Auto-commit enabled (every 10min)" : "Enable auto-commit"}
					>
						{autoCommitEnabled ? "Auto" : "Auto"}
					</button>
				</div>
			</div>

			{/* Tab bar */}
			<div className="flex border-b border-border">
				{(
					[
						["history", "History"],
						["diff", "Diff"],
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						className={`flex-1 text-xs py-1.5 transition-colors ${
							activeTab === key
								? "text-primary border-b-2 border-primary font-medium"
								: "text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab(key)}
					>
						{label}
					</button>
				))}
			</div>

			{/* Content area */}
			<div className="flex-1 overflow-y-auto">
				{activeTab === "history" ? <CommitList /> : <DiffView />}
			</div>

			{/* Selected commit actions (history tab) */}
			{activeTab === "history" && selectedCommitId && (
				<>
					<Separator />
					<div className="px-3 py-2 flex gap-2">
						<Button
							size="sm"
							variant="outline"
							className="flex-1"
							onClick={handleRestore}
							disabled={isRestoring}
						>
							{isRestoring ? "Restoring..." : "Restore this version"}
						</Button>
					</div>
				</>
			)}

			{/* Footer actions */}
			<Separator />
			<div className="px-3 py-2 flex gap-2">
				<Button
					size="sm"
					className="flex-1"
					onClick={() => openCommitDialog()}
				>
					Commit
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setMergeDialogOpen(true)}
				>
					Merge
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setTagManagerOpen(true)}
				>
					Tags
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setBranchManagerOpen(true)}
				>
					Branches
				</Button>
			</div>

			{/* Dialogs */}
			<CommitDialog />
			<BranchManager
				isOpen={branchManagerOpen}
				onOpenChange={setBranchManagerOpen}
			/>
			<TagManager
				isOpen={tagManagerOpen}
				onOpenChange={setTagManagerOpen}
			/>
			<MergeDialog
				isOpen={mergeDialogOpen}
				onOpenChange={setMergeDialogOpen}
			/>
		</div>
	);
}
