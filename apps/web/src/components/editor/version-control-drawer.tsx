"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import { CommitDialog } from "./panels/version-history/commit-dialog";
import { CommitList } from "./panels/version-history/commit-list";
import { DiffView } from "./panels/version-history/diff-view";
import { BranchManager } from "./panels/version-history/branch-manager";
import { TagManager } from "./panels/version-history/tag-manager";
import { MergeDialog } from "./panels/version-history/merge-dialog";

type DrawerTab = "history" | "diff";

export function VersionControlDrawer({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const {
		currentBranch,
		isDirty,
		selectedCommitId,
		isRestoring,
		initialized,
		openCommitDialog,
		setIsRestoring,
		setCommits,
		syncStatus,
		selectCommit,
	} = useVersionStore();

	const [activeTab, setActiveTab] = useState<DrawerTab>("history");
	const [branchManagerOpen, setBranchManagerOpen] = useState(false);
	const [tagManagerOpen, setTagManagerOpen] = useState(false);
	const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

	// Refresh commits when drawer opens
	useEffect(() => {
		if (!open || !initialized) return;
		editor.version.getLog().then(setCommits);
	}, [open, initialized, editor.version, setCommits]);

	const handleRestore = useCallback(async () => {
		if (!selectedCommitId) return;
		const ok = window.confirm(
			"This will replace your current timeline. Uncommitted changes will be lost. Continue?",
		);
		if (!ok) return;

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

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
					{/* Header */}
					<SheetHeader className="px-4 pt-4 pb-2">
						<div className="flex items-center justify-between">
							<SheetTitle className="text-base">Version Control</SheetTitle>
							<div className="flex items-center gap-1.5">
								<span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
									{currentBranch}
								</span>
								{isDirty && (
									<span className="w-2 h-2 rounded-full bg-yellow-500" title="Uncommitted changes" />
								)}
							</div>
						</div>
					</SheetHeader>

					{/* Tab bar */}
					<div className="flex border-b border-border px-4">
						{(
							[
								["history", "History"],
								["diff", "Changes"],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								className={`flex-1 text-xs py-2 transition-colors ${
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

					{/* Content */}
					<div className="flex-1 overflow-y-auto">
						{activeTab === "history" ? <CommitList /> : <DiffView />}
					</div>

					{/* Selected commit actions */}
					{activeTab === "history" && selectedCommitId && (
						<>
							<Separator />
							<div className="px-4 py-2">
								<Button
									size="sm"
									variant="outline"
									className="w-full"
									onClick={handleRestore}
									disabled={isRestoring}
								>
									{isRestoring ? "Restoring..." : "Restore this version"}
								</Button>
							</div>
						</>
					)}

					{/* Action buttons */}
					<Separator />
					<div className="px-4 py-3 flex flex-wrap gap-2">
						<Button size="sm" className="flex-1" onClick={() => openCommitDialog()}>
							Commit
						</Button>
						<Button size="sm" variant="outline" onClick={() => setMergeDialogOpen(true)}>
							Merge
						</Button>
						<Button size="sm" variant="outline" onClick={() => setBranchManagerOpen(true)}>
							Branches
						</Button>
						<Button size="sm" variant="outline" onClick={() => setTagManagerOpen(true)}>
							Tags
						</Button>
					</div>
				</SheetContent>
			</Sheet>

			{/* Sub-dialogs */}
			<CommitDialog />
			<BranchManager isOpen={branchManagerOpen} onOpenChange={setBranchManagerOpen} />
			<TagManager isOpen={tagManagerOpen} onOpenChange={setTagManagerOpen} />
			<MergeDialog isOpen={mergeDialogOpen} onOpenChange={setMergeDialogOpen} />
		</>
	);
}
