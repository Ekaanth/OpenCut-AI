"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ConflictResolver } from "@/services/merge/conflict-resolver";
import type { MergeConflict } from "@/types/version";

export function ConflictResolutionView({
	resolver,
	onAllResolved,
}: {
	resolver: ConflictResolver;
	onAllResolved: () => void;
}) {
	const conflicts = resolver.getConflicts();
	const [currentIdx, setCurrentIdx] = useState(0);
	const [, forceUpdate] = useState(0);

	const rerender = () => forceUpdate((n) => n + 1);

	const current = conflicts[currentIdx];
	const resolution = current ? resolver.getResolution(current.id) : undefined;

	const handleResolve = useCallback(
		(conflictId: string, choice: "source" | "target" | "custom", customValue?: unknown) => {
			resolver.resolveConflict(conflictId, choice, customValue);
			rerender();
			if (resolver.isFullyResolved()) {
				onAllResolved();
			}
		},
		[resolver, onAllResolved],
	);

	const handleAcceptAllSource = useCallback(() => {
		resolver.acceptAllSource();
		rerender();
		onAllResolved();
	}, [resolver, onAllResolved]);

	const handleAcceptAllTarget = useCallback(() => {
		resolver.acceptAllTarget();
		rerender();
		onAllResolved();
	}, [resolver, onAllResolved]);

	if (conflicts.length === 0) {
		return (
			<div className="text-center text-sm text-muted-foreground py-4">
				No conflicts to resolve
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Progress */}
			<div className="flex items-center justify-between">
				<div className="text-xs text-muted-foreground">
					Conflict {currentIdx + 1} of {conflicts.length}
				</div>
				<div className="text-xs">
					<span className="text-green-400">{resolver.getResolvedCount()} resolved</span>
					{" / "}
					<span className="text-muted-foreground">{conflicts.length} total</span>
				</div>
			</div>

			{/* Progress bar */}
			<div className="h-1 rounded-full bg-muted overflow-hidden">
				<div
					className="h-full bg-green-500 transition-all"
					style={{
						width: `${(resolver.getResolvedCount() / conflicts.length) * 100}%`,
					}}
				/>
			</div>

			{/* Batch actions */}
			<div className="flex gap-2">
				<Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleAcceptAllSource}>
					Accept all source
				</Button>
				<Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleAcceptAllTarget}>
					Accept all target
				</Button>
			</div>

			<Separator />

			{/* Current conflict */}
			{current && (
				<ConflictCard
					conflict={current}
					isResolved={!!resolution}
					resolvedWith={resolution?.resolution}
					onResolve={handleResolve}
				/>
			)}

			{/* Navigation */}
			<div className="flex justify-between">
				<Button
					size="sm"
					variant="outline"
					onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
					disabled={currentIdx === 0}
				>
					Previous
				</Button>
				<div className="flex gap-1">
					{conflicts.map((c, idx) => (
						<button
							key={c.id}
							type="button"
							className={`w-5 h-5 rounded text-[10px] ${
								idx === currentIdx
									? "bg-primary text-primary-foreground"
									: resolver.getResolution(c.id)
										? "bg-green-500/20 text-green-400"
										: "bg-muted text-muted-foreground"
							}`}
							onClick={() => setCurrentIdx(idx)}
						>
							{idx + 1}
						</button>
					))}
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setCurrentIdx(Math.min(conflicts.length - 1, currentIdx + 1))}
					disabled={currentIdx === conflicts.length - 1}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

function ConflictCard({
	conflict,
	isResolved,
	resolvedWith,
	onResolve,
}: {
	conflict: MergeConflict;
	isResolved: boolean;
	resolvedWith?: string;
	onResolve: (id: string, choice: "source" | "target" | "custom", customValue?: unknown) => void;
}) {
	const [customMode, setCustomMode] = useState(false);
	const [customValue, setCustomValue] = useState("");

	const isStructural =
		conflict.property === "__track_deleted__" || conflict.property === "__element_deleted__";

	return (
		<div
			className={`rounded border p-3 space-y-2 ${
				isResolved ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="text-sm font-medium">{conflict.elementName}</div>
					<div className="text-xs text-muted-foreground">
						{isStructural
							? conflict.property === "__track_deleted__"
								? "Track deleted in one branch, modified in other"
								: "Element deleted in one branch, modified in other"
							: `Property: ${conflict.property}`}
					</div>
				</div>
				{isResolved && (
					<span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
						Resolved ({resolvedWith})
					</span>
				)}
			</div>

			{/* Values */}
			{!isStructural && (
				<div className="grid grid-cols-3 gap-2 text-xs">
					<div className="rounded bg-muted/50 p-2">
						<div className="text-[10px] text-muted-foreground/60 mb-0.5">Base</div>
						<div className="font-mono truncate">{formatValue(conflict.baseValue)}</div>
					</div>
					<div
						className={`rounded p-2 cursor-pointer transition-colors ${
							resolvedWith === "source"
								? "bg-primary/10 border border-primary/30"
								: "bg-muted/50 hover:bg-muted"
						}`}
						onClick={() => onResolve(conflict.id, "source")}
					>
						<div className="text-[10px] text-muted-foreground/60 mb-0.5">Source</div>
						<div className="font-mono truncate">{formatValue(conflict.sourceValue)}</div>
						<button
							type="button"
							className="text-[10px] text-primary mt-1"
						>
							Use This
						</button>
					</div>
					<div
						className={`rounded p-2 cursor-pointer transition-colors ${
							resolvedWith === "target"
								? "bg-primary/10 border border-primary/30"
								: "bg-muted/50 hover:bg-muted"
						}`}
						onClick={() => onResolve(conflict.id, "target")}
					>
						<div className="text-[10px] text-muted-foreground/60 mb-0.5">Target</div>
						<div className="font-mono truncate">{formatValue(conflict.targetValue)}</div>
						<button
							type="button"
							className="text-[10px] text-primary mt-1"
						>
							Use This
						</button>
					</div>
				</div>
			)}

			{/* Structural conflict buttons */}
			{isStructural && (
				<div className="flex gap-2">
					<Button
						size="sm"
						variant={resolvedWith === "source" ? "default" : "outline"}
						className="flex-1"
						onClick={() => onResolve(conflict.id, "source")}
					>
						{conflict.property === "__track_deleted__" ? "Delete track" : "Delete element"}
					</Button>
					<Button
						size="sm"
						variant={resolvedWith === "target" ? "default" : "outline"}
						className="flex-1"
						onClick={() => onResolve(conflict.id, "target")}
					>
						Keep modified version
					</Button>
				</div>
			)}

			{/* Custom value */}
			{!isStructural && (
				<div>
					{customMode ? (
						<div className="flex gap-2">
							<Input
								value={customValue}
								onChange={(e) => setCustomValue(e.target.value)}
								placeholder="Enter custom value"
								className="text-xs flex-1"
							/>
							<Button
								size="sm"
								onClick={() => {
									let parsed: unknown = customValue;
									try { parsed = JSON.parse(customValue); } catch { /* use as string */ }
									onResolve(conflict.id, "custom", parsed);
									setCustomMode(false);
								}}
							>
								Apply
							</Button>
						</div>
					) : (
						<button
							type="button"
							className="text-[10px] text-muted-foreground hover:text-foreground"
							onClick={() => setCustomMode(true)}
						>
							Or enter custom value...
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
	if (typeof value === "string") return value.length > 30 ? `${value.slice(0, 30)}...` : value;
	if (typeof value === "boolean") return String(value);
	return JSON.stringify(value).slice(0, 40);
}
