"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import type { Branch } from "@/types/version";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function BranchManager({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const { currentBranch, syncStatus, setCommits } = useVersionStore();
	const [branches, setBranches] = useState<Branch[]>([]);
	const [editingBranch, setEditingBranch] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editColor, setEditColor] = useState("");

	const loadBranches = useCallback(async () => {
		const list = await editor.version.listBranches();
		setBranches(list);
	}, [editor.version]);

	useEffect(() => {
		if (isOpen) loadBranches();
	}, [isOpen, loadBranches]);

	const handleDelete = useCallback(
		async (name: string) => {
			const confirmed = window.confirm(
				`Delete branch "${name}"? This cannot be undone.`,
			);
			if (!confirmed) return;

			try {
				await editor.version.deleteBranch(name);
				await loadBranches();
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Delete failed";
				window.alert(msg);
			}
		},
		[editor.version, loadBranches],
	);

	const startEditing = (branch: Branch) => {
		setEditingBranch(branch.id);
		setEditName(branch.name);
		setEditDescription(branch.description ?? "");
		setEditColor(branch.color ?? "");
	};

	const saveEditing = useCallback(
		async (branch: Branch) => {
			try {
				if (editName !== branch.name) {
					await editor.version.renameBranch(branch.name, editName);
				}
				await editor.version.updateBranch(editName, {
					description: editDescription || undefined,
					color: editColor || undefined,
				});
				setEditingBranch(null);
				await loadBranches();
				syncStatus(editor.version.status());
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Update failed";
				window.alert(msg);
			}
		},
		[editName, editDescription, editColor, editor.version, loadBranches, syncStatus],
	);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Manage Branches</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-0 p-0">
					<div className="max-h-80 overflow-y-auto divide-y divide-border">
						{branches.map((branch) => (
							<div key={branch.id} className="px-4 py-3">
								{editingBranch === branch.id ? (
									<div className="space-y-2">
										<Input
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											placeholder="Branch name"
											className="text-sm"
										/>
										<Input
											value={editDescription}
											onChange={(e) => setEditDescription(e.target.value)}
											placeholder="Description (optional)"
											className="text-xs"
										/>
										<div className="flex items-center gap-2">
											<label className="text-xs text-muted-foreground">Color:</label>
											<input
												type="color"
												value={editColor || "#6366f1"}
												onChange={(e) => setEditColor(e.target.value)}
												className="w-6 h-6 rounded border border-border cursor-pointer"
											/>
										</div>
										<div className="flex gap-2 justify-end">
											<Button
												size="sm"
												variant="outline"
												onClick={() => setEditingBranch(null)}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												onClick={() => saveEditing(branch)}
											>
												Save
											</Button>
										</div>
									</div>
								) : (
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												{branch.color && (
													<span
														className="w-2.5 h-2.5 rounded-full flex-shrink-0"
														style={{ backgroundColor: branch.color }}
													/>
												)}
												<span className="text-sm font-medium">
													{branch.name}
												</span>
												{branch.name === currentBranch && (
													<span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
														current
													</span>
												)}
											</div>
											{branch.description && (
												<div className="text-xs text-muted-foreground mt-0.5 truncate">
													{branch.description}
												</div>
											)}
											<div className="text-[10px] text-muted-foreground/50 mt-0.5">
												Created {formatDate(branch.createdAt)}
												{branch.createdFromBranch !== branch.name &&
													` from ${branch.createdFromBranch}`}
											</div>
										</div>
										<div className="flex gap-1 flex-shrink-0">
											<button
												type="button"
												className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
												onClick={() => startEditing(branch)}
											>
												Edit
											</button>
											{branch.name !== "main" &&
												branch.name !== currentBranch && (
													<button
														type="button"
														className="text-xs text-destructive/70 hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10"
														onClick={() => handleDelete(branch.name)}
													>
														Delete
													</button>
												)}
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
