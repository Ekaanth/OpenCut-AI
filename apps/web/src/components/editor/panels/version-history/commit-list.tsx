"use client";

import { useVersionStore } from "@/stores/version-store";
import { CommitItem } from "./commit-item";

export function CommitList() {
	const { commits, selectedCommitId, isDirty, isLoading } = useVersionStore();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-sm text-muted-foreground/60">
				Loading history...
			</div>
		);
	}

	if (commits.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 px-4 text-center">
				<div className="text-sm text-muted-foreground/60">
					No version history yet.
				</div>
				<div className="text-xs text-muted-foreground/40 mt-1">
					Make your first commit to start tracking changes.
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col divide-y divide-border/50">
			{/* Uncommitted changes indicator */}
			{isDirty && (
				<div className="px-3 py-2 bg-yellow-500/5 border-l-2 border-l-yellow-500">
					<div className="text-sm font-medium text-yellow-500/80">
						Unsaved changes
					</div>
					<div className="text-xs text-muted-foreground/60">
						Changes not yet committed
					</div>
				</div>
			)}

			{/* Commit list */}
			{commits.map((commit) => (
				<CommitItem
					key={commit.id}
					commit={commit}
					isSelected={selectedCommitId === commit.id}
				/>
			))}
		</div>
	);
}
