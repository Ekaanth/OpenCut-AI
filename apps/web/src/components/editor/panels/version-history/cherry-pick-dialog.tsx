"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
import type { Commit, PropertyChange, MergeConflict } from "@/types/version";

export function CherryPickDialog({
	isOpen,
	onOpenChange,
	commit,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	commit: Commit | null;
}) {
	const editor = useEditor();
	const { setCommits, syncStatus } = useVersionStore();

	const [applied, setApplied] = useState<PropertyChange[]>([]);
	const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
	const [previewed, setPreviewed] = useState(false);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState("");

	const handlePreview = useCallback(async () => {
		if (!commit) return;
		setLoading(true);
		setError("");
		try {
			const result = await editor.version.cherryPickCommit(commit.id);
			setApplied(result.applied);
			setConflicts(result.conflicts);
			setPreviewed(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Cherry-pick failed");
		} finally {
			setLoading(false);
		}
	}, [commit, editor.version]);

	const handleApply = useCallback(async () => {
		if (!commit || conflicts.length > 0) return;
		setLoading(true);
		try {
			// Cherry-pick was previewed, now actually commit it
			await editor.version.commit(
				`Cherry-pick: ${commit.message}`,
			);
			const commits = await editor.version.getLog();
			setCommits(commits);
			syncStatus(editor.version.status());
			setDone(true);
			setTimeout(() => onOpenChange(false), 1500);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Commit failed");
		} finally {
			setLoading(false);
		}
	}, [commit, conflicts, editor.version, setCommits, syncStatus, onOpenChange]);

	if (!commit) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					setPreviewed(false);
					setApplied([]);
					setConflicts([]);
					setDone(false);
					setError("");
				}
				onOpenChange(open);
			}}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Cherry-pick Commit</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					{error && (
						<div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
							{error}
						</div>
					)}

					{done ? (
						<div className="text-center py-4 text-sm text-green-400 font-medium">
							Cherry-pick committed successfully
						</div>
					) : (
						<>
							{/* Commit info */}
							<div className="rounded border border-border p-3">
								<div className="text-sm font-medium">{commit.message}</div>
								<div className="text-xs text-muted-foreground mt-1">
									{new Date(commit.timestamp).toLocaleString()}
								</div>
								<div className="text-xs text-muted-foreground/60 mt-0.5">
									{commit.changeSummary.elementsAdded > 0 && `+${commit.changeSummary.elementsAdded} `}
									{commit.changeSummary.elementsRemoved > 0 && `-${commit.changeSummary.elementsRemoved} `}
									{commit.changeSummary.elementsModified > 0 && `~${commit.changeSummary.elementsModified} `}
									elements
								</div>
							</div>

							{previewed && (
								<>
									<Separator />

									{/* Applied changes */}
									{applied.length > 0 && (
										<div>
											<div className="text-xs font-medium text-green-400 mb-1">
												Changes to apply ({applied.length})
											</div>
											<div className="space-y-0.5 max-h-32 overflow-y-auto">
												{applied.map((change, idx) => (
													<div
														key={idx}
														className="text-xs text-muted-foreground"
													>
														{change.humanReadable}
													</div>
												))}
											</div>
										</div>
									)}

									{/* Conflicts */}
									{conflicts.length > 0 && (
										<div>
											<div className="text-xs font-medium text-yellow-400 mb-1">
												Conflicts ({conflicts.length})
											</div>
											<div className="space-y-1 max-h-32 overflow-y-auto">
												{conflicts.map((c) => (
													<div
														key={c.id}
														className="text-xs text-yellow-400/70"
													>
														{c.elementName}: {c.property}
													</div>
												))}
											</div>
											<div className="text-xs text-muted-foreground/60 mt-1">
												Cannot cherry-pick with unresolved conflicts.
											</div>
										</div>
									)}

									{applied.length === 0 && conflicts.length === 0 && (
										<div className="text-xs text-muted-foreground/60 text-center py-2">
											No applicable changes found
										</div>
									)}
								</>
							)}
						</>
					)}
				</DialogBody>

				{!done && (
					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						{!previewed ? (
							<Button onClick={handlePreview} disabled={loading}>
								{loading ? "Analyzing..." : "Preview Changes"}
							</Button>
						) : (
							<Button
								onClick={handleApply}
								disabled={loading || conflicts.length > 0 || applied.length === 0}
							>
								{loading ? "Applying..." : "Apply Cherry-pick"}
							</Button>
						)}
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
