"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEditor } from "@/hooks/use-editor";
import { useVersionStore } from "@/stores/version-store";
import { ChangeSummary } from "./change-summary";
import { groupChangesByCategory } from "@/services/diff/project-diff";
import type {
	TimelineDiff,
	ChangeCategory,
	Commit,
} from "@/types/version";

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
	structure: "Structure",
	content: "Content",
	timing: "Timing",
	visual: "Visual",
	audio: "Audio",
	text: "Text",
};

const CATEGORY_ICONS: Record<ChangeCategory, string> = {
	structure: "##",
	content: "[]",
	timing: ">|",
	visual: "()>",
	audio: ")))",
	text: "Aa",
};

type DiffMode = "working" | "commits" | "branches";

export function DiffView() {
	const editor = useEditor();
	const { commits, initialized } = useVersionStore();

	const [mode, setMode] = useState<DiffMode>("working");
	const [diff, setDiff] = useState<TimelineDiff | null>(null);
	const [loading, setLoading] = useState(false);
	const [commitA, setCommitA] = useState<string>("");
	const [commitB, setCommitB] = useState<string>("");
	const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
		new Set(),
	);

	// Load working diff by default
	useEffect(() => {
		if (!initialized || mode !== "working") return;
		setLoading(true);
		editor.version
			.diffWorkingState()
			.then(setDiff)
			.catch(() => setDiff(null))
			.finally(() => setLoading(false));
	}, [mode, initialized, editor.version]);

	const handleCompareTwoCommits = useCallback(async () => {
		if (!commitA || !commitB) return;
		setLoading(true);
		try {
			const result = await editor.version.diff(commitA, commitB);
			setDiff(result);
		} catch {
			setDiff(null);
		} finally {
			setLoading(false);
		}
	}, [commitA, commitB, editor.version]);

	const toggleCategory = (cat: string) => {
		setCollapsedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(cat)) next.delete(cat);
			else next.add(cat);
			return next;
		});
	};

	const grouped = diff ? groupChangesByCategory(diff) : null;

	return (
		<div className="flex flex-col h-full">
			{/* Mode tabs */}
			<div className="flex border-b border-border">
				{(
					[
						["working", "Working vs HEAD"],
						["commits", "Compare Commits"],
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						className={`flex-1 text-xs py-2 transition-colors ${
							mode === key
								? "text-primary border-b-2 border-primary font-medium"
								: "text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setMode(key)}
					>
						{label}
					</button>
				))}
			</div>

			{/* Commit selectors for compare mode */}
			{mode === "commits" && (
				<div className="px-3 py-2 space-y-2 border-b border-border">
					<div>
						<label className="text-[10px] text-muted-foreground">Version A (older)</label>
						<select
							value={commitA}
							onChange={(e) => setCommitA(e.target.value)}
							className="w-full mt-0.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
						>
							<option value="">Select commit...</option>
							{commits.map((c) => (
								<option key={c.id} value={c.id}>
									{c.message} ({new Date(c.timestamp).toLocaleDateString()})
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="text-[10px] text-muted-foreground">Version B (newer)</label>
						<select
							value={commitB}
							onChange={(e) => setCommitB(e.target.value)}
							className="w-full mt-0.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
						>
							<option value="">Select commit...</option>
							{commits.map((c) => (
								<option key={c.id} value={c.id}>
									{c.message} ({new Date(c.timestamp).toLocaleDateString()})
								</option>
							))}
						</select>
					</div>
					<Button
						size="sm"
						className="w-full"
						onClick={handleCompareTwoCommits}
						disabled={!commitA || !commitB || loading}
					>
						Compare
					</Button>
				</div>
			)}

			{/* Diff content */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="text-center text-sm text-muted-foreground/60 py-8">
						Computing diff...
					</div>
				) : !diff ? (
					<div className="text-center text-sm text-muted-foreground/60 py-8">
						{mode === "working"
							? "No uncommitted changes"
							: "Select two commits to compare"}
					</div>
				) : diff.totalChanges === 0 ? (
					<div className="text-center text-sm text-muted-foreground/60 py-8">
						No differences found
					</div>
				) : (
					<div className="py-2">
						{/* Summary badge bar */}
						<div className="flex items-center gap-2 px-3 pb-2 flex-wrap">
							<span className="text-xs text-muted-foreground">
								{diff.totalChanges} change{diff.totalChanges !== 1 ? "s" : ""}
							</span>
							{diff.changeSummary.elementsAdded > 0 && (
								<span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
									+{diff.changeSummary.elementsAdded} added
								</span>
							)}
							{diff.changeSummary.elementsRemoved > 0 && (
								<span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
									-{diff.changeSummary.elementsRemoved} removed
								</span>
							)}
							{diff.changeSummary.elementsModified > 0 && (
								<span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
									~{diff.changeSummary.elementsModified} modified
								</span>
							)}
						</div>

						<Separator />

						{/* Scene-level additions/removals */}
						{(diff.scenes.added.length > 0 || diff.scenes.removed.length > 0) && (
							<div className="px-3 py-2 space-y-1">
								{diff.scenes.added.map((s) => (
									<div key={s.sceneId} className="text-xs flex items-center gap-1.5">
										<span className="text-green-400 font-mono">+</span>
										<span>Scene &quot;{s.sceneName}&quot; added ({s.trackCount} tracks)</span>
									</div>
								))}
								{diff.scenes.removed.map((s) => (
									<div key={s.sceneId} className="text-xs flex items-center gap-1.5">
										<span className="text-red-400 font-mono">-</span>
										<span>Scene &quot;{s.sceneName}&quot; removed</span>
									</div>
								))}
							</div>
						)}

						{/* Categorized property changes */}
						{grouped &&
							(Object.keys(grouped) as ChangeCategory[]).map((cat) => {
								const changes = grouped[cat];
								if (changes.length === 0) return null;
								const isCollapsed = collapsedCategories.has(cat);

								return (
									<div key={cat}>
										<button
											type="button"
											className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
											onClick={() => toggleCategory(cat)}
										>
											<div className="flex items-center gap-2">
												<span className="text-[10px] font-mono text-muted-foreground w-6">
													{CATEGORY_ICONS[cat]}
												</span>
												<span className="text-xs font-medium">
													{CATEGORY_LABELS[cat]}
												</span>
												<span className="text-[10px] text-muted-foreground/60">
													({changes.length})
												</span>
											</div>
											<svg
												width="12"
												height="12"
												viewBox="0 0 16 16"
												fill="none"
												className={`text-muted-foreground transition-transform ${
													isCollapsed ? "" : "rotate-90"
												}`}
											>
												<path
													d="M6 4l4 4-4 4"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</button>

										{!isCollapsed && (
											<div className="pl-9 pr-3 pb-1 space-y-0.5">
												{changes.map((change, idx) => (
													<div
														key={`${change.path}-${idx}`}
														className="text-xs text-muted-foreground py-0.5"
													>
														{change.humanReadable}
													</div>
												))}
											</div>
										)}
									</div>
								);
							})}

						{/* Track-level changes */}
						{diff.scenes.modified.map((scene) => (
							<div key={scene.sceneId}>
								{scene.trackChanges.added.map((t) => (
									<div
										key={t.trackId}
										className="px-3 py-0.5 text-xs flex items-center gap-1.5"
									>
										<span className="text-green-400 font-mono">+</span>
										<span>
											Added {t.trackType} track &quot;{t.trackName}&quot; ({t.elementCount} elements)
										</span>
									</div>
								))}
								{scene.trackChanges.removed.map((t) => (
									<div
										key={t.trackId}
										className="px-3 py-0.5 text-xs flex items-center gap-1.5"
									>
										<span className="text-red-400 font-mono">-</span>
										<span>Removed {t.trackType} track &quot;{t.trackName}&quot;</span>
									</div>
								))}
								{scene.elementChanges.added.map((e) => (
									<div
										key={e.elementId}
										className="px-3 py-0.5 text-xs flex items-center gap-1.5"
									>
										<span className="text-green-400 font-mono">+</span>
										<span>
											Added &quot;{e.elementName}&quot; ({e.elementType}) to {e.trackName}
										</span>
									</div>
								))}
								{scene.elementChanges.removed.map((e) => (
									<div
										key={e.elementId}
										className="px-3 py-0.5 text-xs flex items-center gap-1.5"
									>
										<span className="text-red-400 font-mono">-</span>
										<span>
											Removed &quot;{e.elementName}&quot; ({e.elementType}) from {e.trackName}
										</span>
									</div>
								))}
								{scene.elementChanges.moved.map((e) => (
									<div
										key={e.elementId}
										className="px-3 py-0.5 text-xs flex items-center gap-1.5"
									>
										<span className="text-blue-400 font-mono">&gt;</span>
										<span>
											Moved &quot;{e.elementName}&quot; to different track
										</span>
									</div>
								))}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
