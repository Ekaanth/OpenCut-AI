"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import { ChangeSummary } from "./change-summary";
import { generateAICommitMessage } from "@/services/version/ai-commit-message";
import type { TimelineDiff } from "@/types/version";

export function CommitDialog() {
	const editor = useEditor();
	const { commitDialogOpen, closeCommitDialog, isCommitting } =
		useVersionStore();

	const [message, setMessage] = useState("");
	const [tagName, setTagName] = useState("");
	const [diff, setDiff] = useState<TimelineDiff | null>(null);
	const [loadingDiff, setLoadingDiff] = useState(false);
	const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
	const [loadingAI, setLoadingAI] = useState(false);

	// Load diff when dialog opens
	useEffect(() => {
		if (!commitDialogOpen) return;
		setMessage("");
		setTagName("");
		setAiSuggestion(null);
		setLoadingDiff(true);

		editor.version
			.diffWorkingState()
			.then((d) => {
				setDiff(d);
				// Generate AI suggestion in background
				if (d && d.totalChanges > 0) {
					setLoadingAI(true);
					generateAICommitMessage(d)
						.then((suggestion) => setAiSuggestion(suggestion))
						.catch(() => {})
						.finally(() => setLoadingAI(false));
				}
			})
			.catch(() => setDiff(null))
			.finally(() => setLoadingDiff(false));
	}, [commitDialogOpen, editor.version]);

	const handleCommit = useCallback(async () => {
		if (!message.trim()) return;

		const store = useVersionStore.getState();
		store.setIsCommitting(true);

		try {
			const commit = await editor.version.commit(message.trim(), {
				tag: tagName.trim() || undefined,
			});

			// Refresh commits list
			const commits = await editor.version.getLog();
			store.setCommits(commits);
			store.syncStatus(editor.version.status());
			store.closeCommitDialog();
		} catch (err) {
			console.error("Commit failed:", err);
		} finally {
			store.setIsCommitting(false);
		}
	}, [message, tagName, editor.version]);

	const hasChanges = diff ? diff.totalChanges > 0 : false;
	const canCommit = message.trim().length > 0 && hasChanges && !isCommitting;

	return (
		<Dialog open={commitDialogOpen} onOpenChange={(open) => !open && closeCommitDialog()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Commit Changes</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					{/* Change summary */}
					<div>
						<Label className="text-xs text-muted-foreground mb-1">
							Summary of changes
						</Label>
						<div className="rounded-md border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
							{loadingDiff ? (
								<div className="text-muted-foreground/60 text-sm text-center py-2">
									Analyzing changes...
								</div>
							) : diff ? (
								<ChangeSummary diff={diff} />
							) : (
								<div className="text-muted-foreground/60 text-sm text-center py-2">
									No changes detected
								</div>
							)}
						</div>
					</div>

					<Separator />

					{/* AI suggestion */}
					{(loadingAI || aiSuggestion) && (
						<div className="flex items-center gap-2">
							{loadingAI ? (
								<span className="text-xs text-muted-foreground/60">Generating AI suggestion...</span>
							) : aiSuggestion ? (
								<>
									<span className="text-xs text-muted-foreground/60">AI:</span>
									<button
										type="button"
										className="text-xs text-primary hover:underline truncate max-w-[280px] text-left"
										onClick={() => setMessage(aiSuggestion)}
										title={aiSuggestion}
									>
										{aiSuggestion}
									</button>
								</>
							) : null}
						</div>
					)}

					{/* Commit message */}
					<div>
						<Label htmlFor="commit-message">Commit message</Label>
						<textarea
							id="commit-message"
							className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
							rows={3}
							placeholder="Describe your changes..."
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									if (canCommit) handleCommit();
								}
							}}
							autoFocus
						/>
					</div>

					{/* Optional tag */}
					<div>
						<Label htmlFor="tag-name" className="text-xs text-muted-foreground">
							Add tag (optional)
						</Label>
						<Input
							id="tag-name"
							value={tagName}
							onChange={(e) => setTagName(e.target.value)}
							placeholder="e.g. rough-cut, v1-final"
							className="mt-1"
						/>
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => closeCommitDialog()}>
						Cancel
					</Button>
					<Button onClick={handleCommit} disabled={!canCommit}>
						{isCommitting ? "Committing..." : "Commit"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
