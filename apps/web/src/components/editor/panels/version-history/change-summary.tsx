"use client";

import type { TimelineDiff, ChangeCategory } from "@/types/version";
import { groupChangesByCategory } from "@/services/diff/project-diff";

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
	structure: "Structure",
	content: "Content",
	timing: "Timing",
	visual: "Visual",
	audio: "Audio",
	text: "Text",
};

const CATEGORY_COLORS: Record<ChangeCategory, string> = {
	structure: "text-purple-400",
	content: "text-blue-400",
	timing: "text-yellow-400",
	visual: "text-green-400",
	audio: "text-orange-400",
	text: "text-pink-400",
};

export function ChangeSummary({ diff }: { diff: TimelineDiff }) {
	const grouped = groupChangesByCategory(diff);
	const { scenes } = diff;

	const hasSceneChanges =
		scenes.added.length > 0 || scenes.removed.length > 0;
	const hasElementAdds = scenes.modified.some(
		(s) => s.elementChanges.added.length > 0,
	);
	const hasElementRemoves = scenes.modified.some(
		(s) => s.elementChanges.removed.length > 0,
	);
	const hasTrackChanges = scenes.modified.some(
		(s) =>
			s.trackChanges.added.length > 0 || s.trackChanges.removed.length > 0,
	);

	return (
		<div className="space-y-2 text-sm">
			{/* Top-level structural changes */}
			{hasSceneChanges && (
				<div className="space-y-1">
					{scenes.added.map((s) => (
						<div key={s.sceneId} className="flex items-center gap-2">
							<span className="text-green-400 text-xs font-mono">+</span>
							<span className="text-muted-foreground">
								Added scene &quot;{s.sceneName}&quot;
							</span>
						</div>
					))}
					{scenes.removed.map((s) => (
						<div key={s.sceneId} className="flex items-center gap-2">
							<span className="text-red-400 text-xs font-mono">-</span>
							<span className="text-muted-foreground">
								Removed scene &quot;{s.sceneName}&quot;
							</span>
						</div>
					))}
				</div>
			)}

			{/* Track additions/removals */}
			{hasTrackChanges &&
				scenes.modified.map((scene) => (
					<div key={scene.sceneId} className="space-y-1">
						{scene.trackChanges.added.map((t) => (
							<div key={t.trackId} className="flex items-center gap-2">
								<span className="text-green-400 text-xs font-mono">+</span>
								<span className="text-muted-foreground">
									Added {t.trackType} track &quot;{t.trackName}&quot;
								</span>
							</div>
						))}
						{scene.trackChanges.removed.map((t) => (
							<div key={t.trackId} className="flex items-center gap-2">
								<span className="text-red-400 text-xs font-mono">-</span>
								<span className="text-muted-foreground">
									Removed {t.trackType} track &quot;{t.trackName}&quot;
								</span>
							</div>
						))}
					</div>
				))}

			{/* Element additions/removals */}
			{hasElementAdds &&
				scenes.modified.map((scene) =>
					scene.elementChanges.added.map((elem) => (
						<div
							key={elem.elementId}
							className="flex items-center gap-2"
						>
							<span className="text-green-400 text-xs font-mono">+</span>
							<span className="text-muted-foreground">
								Added &quot;{elem.elementName}&quot; ({elem.elementType})
							</span>
						</div>
					)),
				)}
			{hasElementRemoves &&
				scenes.modified.map((scene) =>
					scene.elementChanges.removed.map((elem) => (
						<div
							key={elem.elementId}
							className="flex items-center gap-2"
						>
							<span className="text-red-400 text-xs font-mono">-</span>
							<span className="text-muted-foreground">
								Removed &quot;{elem.elementName}&quot; ({elem.elementType})
							</span>
						</div>
					)),
				)}

			{/* Property changes by category */}
			{(Object.keys(grouped) as ChangeCategory[]).map((category) => {
				const changes = grouped[category];
				if (changes.length === 0) return null;
				return (
					<div key={category} className="space-y-1">
						<div
							className={`text-xs font-medium ${CATEGORY_COLORS[category]}`}
						>
							{CATEGORY_LABELS[category]} ({changes.length})
						</div>
						{changes.slice(0, 5).map((change, idx) => (
							<div
								key={`${change.path}-${idx}`}
								className="flex items-center gap-2 pl-3"
							>
								<span className="text-yellow-400 text-xs font-mono">~</span>
								<span className="text-muted-foreground text-xs truncate">
									{change.humanReadable}
								</span>
							</div>
						))}
						{changes.length > 5 && (
							<div className="text-xs text-muted-foreground/60 pl-3">
								...and {changes.length - 5} more
							</div>
						)}
					</div>
				);
			})}

			{diff.totalChanges === 0 && (
				<div className="text-muted-foreground/60 text-center py-2">
					No changes to commit
				</div>
			)}
		</div>
	);
}
