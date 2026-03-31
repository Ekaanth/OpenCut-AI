"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEditor } from "@/hooks/use-editor";
import { useVersionStore } from "@/stores/version-store";
import { ConflictResolutionView } from "./conflict-resolution";
import type { Branch, MergeResult } from "@/types/version";
import type { ConflictResolver } from "@/services/merge/conflict-resolver";

type MergeStep = "select" | "preview" | "conflicts" | "done";

export function MergeDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const { currentBranch, setCommits, syncStatus } = useVersionStore();

	const [step, setStep] = useState<MergeStep>("select");
	const [branches, setBranches] = useState<Branch[]>([]);
	const [sourceBranch, setSourceBranch] = useState("");
	const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
	const [commitMessage, setCommitMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!isOpen) return;
		setStep("select");
		setSourceBranch("");
		setMergeResult(null);
		setCommitMessage("");
		setError("");
		editor.version.listBranches().then((list) => {
			setBranches(list.filter((b) => b.name !== currentBranch));
		});
	}, [isOpen, editor.version, currentBranch]);

	const handlePreview = useCallback(async () => {
		if (!sourceBranch) return;
		setLoading(true);
		setError("");
		try {
			const result = await editor.version.merge(sourceBranch);
			setMergeResult(result);
			setCommitMessage(`Merge ${sourceBranch} into ${currentBranch}`);

			if (result.conflicts.length > 0) {
				setStep("conflicts");
			} else {
				setStep("preview");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Merge failed");
		} finally {
			setLoading(false);
		}
	}, [sourceBranch, currentBranch, editor.version]);

	const handleCompleteMerge = useCallback(async () => {
		if (!mergeResult || !sourceBranch) return;

		setLoading(true);
		try {
			let finalSnapshot = mergeResult.merged;

			// If there were conflicts, get resolved snapshot
			const resolver = editor.version.getConflictResolver();
			if (resolver && resolver.isFullyResolved()) {
				finalSnapshot = resolver.applyResolutions();
			}

			await editor.version.completeMerge(
				sourceBranch,
				finalSnapshot,
				commitMessage || undefined,
			);

			const commits = await editor.version.getLog();
			setCommits(commits);
			syncStatus(editor.version.status());

			setStep("done");
			setTimeout(() => onOpenChange(false), 1500);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Merge commit failed");
		} finally {
			setLoading(false);
		}
	}, [mergeResult, sourceBranch, commitMessage, editor.version, setCommits, syncStatus, onOpenChange]);

	const handleAbort = useCallback(() => {
		editor.version.abortMerge();
		onOpenChange(false);
	}, [editor.version, onOpenChange]);

	const resolver = editor.version.getConflictResolver();

	return (
		<Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleAbort(); }}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{step === "done"
							? "Merge Complete"
							: `Merge into ${currentBranch}`}
					</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					{error && (
						<div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
							{error}
						</div>
					)}

					{/* Step 1: Select source branch */}
					{step === "select" && (
						<div className="space-y-3">
							<div>
								<Label>Source branch</Label>
								<select
									value={sourceBranch}
									onChange={(e) => setSourceBranch(e.target.value)}
									className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="">Select branch to merge...</option>
									{branches.map((b) => (
										<option key={b.id} value={b.name}>
											{b.name}
										</option>
									))}
								</select>
							</div>
							{sourceBranch && (
								<div className="text-xs text-muted-foreground">
									This will merge changes from{" "}
									<span className="font-medium text-foreground">{sourceBranch}</span>{" "}
									into{" "}
									<span className="font-medium text-foreground">{currentBranch}</span>
								</div>
							)}
						</div>
					)}

					{/* Step 2: Clean merge preview */}
					{step === "preview" && mergeResult && (
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-sm">
								<span className="w-2 h-2 rounded-full bg-green-500" />
								<span className="text-green-400 font-medium">Clean merge</span>
								<span className="text-muted-foreground">
									— {mergeResult.autoResolved.length} change{mergeResult.autoResolved.length !== 1 ? "s" : ""} will be applied
								</span>
							</div>

							{mergeResult.autoResolved.length > 0 && (
								<div className="rounded border border-border bg-muted/30 p-3 max-h-40 overflow-y-auto space-y-1">
									{mergeResult.autoResolved.map((change, idx) => (
										<div key={idx} className="text-xs text-muted-foreground">
											{change.humanReadable}
										</div>
									))}
								</div>
							)}

							<Separator />

							<div>
								<Label>Merge commit message</Label>
								<Input
									value={commitMessage}
									onChange={(e) => setCommitMessage(e.target.value)}
									className="mt-1"
								/>
							</div>
						</div>
					)}

					{/* Step 3: Conflict resolution */}
					{step === "conflicts" && resolver && (
						<ConflictResolutionView
							resolver={resolver}
							onAllResolved={() => setStep("preview")}
						/>
					)}

					{/* Step 4: Done */}
					{step === "done" && (
						<div className="text-center py-4">
							<div className="text-sm text-green-400 font-medium">
								Merge committed successfully
							</div>
						</div>
					)}
				</DialogBody>

				{step !== "done" && (
					<DialogFooter>
						<Button variant="outline" onClick={handleAbort}>
							{step === "select" ? "Cancel" : "Abort Merge"}
						</Button>
						{step === "select" && (
							<Button
								onClick={handlePreview}
								disabled={!sourceBranch || loading}
							>
								{loading ? "Analyzing..." : "Preview Merge"}
							</Button>
						)}
						{step === "preview" && (
							<Button onClick={handleCompleteMerge} disabled={loading}>
								{loading ? "Merging..." : "Confirm Merge"}
							</Button>
						)}
						{step === "conflicts" && resolver && (
							<Button
								onClick={() => {
									if (resolver.isFullyResolved()) {
										setStep("preview");
									}
								}}
								disabled={!resolver.isFullyResolved()}
							>
								Continue ({resolver.getResolvedCount()}/{resolver.getConflictCount()} resolved)
							</Button>
						)}
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
