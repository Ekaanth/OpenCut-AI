"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useVersionStore } from "@/stores/version-store";
import { useEditor } from "@/hooks/use-editor";
import { CreateBranchDialog } from "./create-branch-dialog";
import type { Branch } from "@/types/version";

export function BranchSwitcher() {
	const editor = useEditor();
	const { currentBranch, isDirty, initialized, setCommits, syncStatus } =
		useVersionStore();

	const [open, setOpen] = useState(false);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [switching, setSwitching] = useState(false);

	// Load branches when popover opens
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
				const confirmed = window.confirm(
					"You have uncommitted changes. Switching branches will discard them. Continue?",
				);
				if (!confirmed) return;
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

	const handleCreateBranch = useCallback(
		async (name: string, description?: string) => {
			try {
				const branch = await editor.version.createBranch(name);
				if (description) {
					await editor.version.updateBranch(name, { description });
				}
				setCreateDialogOpen(false);
				// Switch to the new branch
				await handleSwitch(name);
			} catch (err) {
				console.error("Create branch failed:", err);
			}
		},
		[editor.version, handleSwitch],
	);

	if (!initialized) return null;

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted transition-colors"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 16 16"
							fill="none"
							className="text-muted-foreground"
						>
							<path
								d="M5 3v6.5a3.5 3.5 0 1 0 3 3.46V3M11 3v3.5a3.5 3.5 0 0 1-3 3.46"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<circle cx="5" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
							<circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
							<circle cx="5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" />
						</svg>
						<span className="font-medium">{currentBranch}</span>
						{isDirty && (
							<span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
						)}
						<svg
							width="10"
							height="10"
							viewBox="0 0 16 16"
							fill="none"
							className="text-muted-foreground"
						>
							<path
								d="M4 6l4 4 4-4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				</PopoverTrigger>

				<PopoverContent className="w-56 p-0" align="start">
					<div className="px-3 py-2 text-xs text-muted-foreground font-medium">
						Branches
					</div>
					<Separator />

					<div className="max-h-48 overflow-y-auto py-1">
						{branches.map((branch) => (
							<button
								key={branch.id}
								type="button"
								className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center justify-between ${
									branch.name === currentBranch ? "text-primary font-medium" : ""
								}`}
								onClick={() => handleSwitch(branch.name)}
								disabled={switching}
							>
								<div className="flex items-center gap-2 min-w-0">
									{branch.color && (
										<span
											className="w-2 h-2 rounded-full flex-shrink-0"
											style={{ backgroundColor: branch.color }}
										/>
									)}
									<span className="truncate">{branch.name}</span>
								</div>
								{branch.name === currentBranch && (
									<svg
										width="14"
										height="14"
										viewBox="0 0 16 16"
										fill="none"
										className="flex-shrink-0 text-primary"
									>
										<path
											d="M3 8l3.5 3.5L13 5"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</button>
						))}
					</div>

					<Separator />
					<div className="p-1">
						<button
							type="button"
							className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-muted-foreground"
							onClick={() => {
								setOpen(false);
								setCreateDialogOpen(true);
							}}
						>
							+ New Branch...
						</button>
					</div>
				</PopoverContent>
			</Popover>

			<CreateBranchDialog
				isOpen={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onConfirm={handleCreateBranch}
				currentBranch={currentBranch}
			/>
		</>
	);
}
