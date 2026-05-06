"use client";

import { useState, useMemo, useCallback } from "react";
import { BasePage } from "@/app/base-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ACTIONS, type TAction, type TActionCategory } from "@/lib/actions/definitions";
import { useKeybindingsStore } from "@/stores/keybindings-store";
import { cn } from "@/utils/ui";

const CATEGORIES: { key: TActionCategory; label: string }[] = [
	{ key: "playback", label: "Playback" },
	{ key: "navigation", label: "Navigation" },
	{ key: "editing", label: "Editing" },
	{ key: "selection", label: "Selection" },
	{ key: "history", label: "History" },
	{ key: "timeline", label: "Timeline" },
	{ key: "controls", label: "Controls" },
	{ key: "version", label: "Version Control" },
	{ key: "ai", label: "AI" },
];

export default function ShortcutsPage() {
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState<TActionCategory | "all">("all");
	const [editingAction, setEditingAction] = useState<TAction | null>(null);

	const filteredActions = useMemo(() => {
		const entries = Object.entries(ACTIONS) as [TAction, typeof ACTIONS[TAction]][];
		return entries.filter(([action, def]) => {
			if (activeCategory !== "all" && def.category !== activeCategory) return false;
			if (search) {
				const q = search.toLowerCase();
				return (
					action.includes(q) ||
					def.description.toLowerCase().includes(q)
				);
			}
			return true;
		});
	}, [search, activeCategory]);

	return (
		<BasePage maxWidth="6xl" title="Keyboard Shortcuts" description="Customize keyboard shortcuts for all editor actions.">
			<div className="flex flex-col gap-6">
				<div className="flex gap-4 items-center">
					<Input
						placeholder="Search shortcuts..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="max-w-sm"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							useKeybindingsStore.getState().resetToDefaults();
						}}
					>
						Reset to Defaults
					</Button>
				</div>

				<div className="flex gap-2 flex-wrap">
					<Button
						variant={activeCategory === "all" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setActiveCategory("all")}
					>
						All
					</Button>
					{CATEGORIES.map((cat) => (
						<Button
							key={cat.key}
							variant={activeCategory === cat.key ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveCategory(cat.key)}
						>
							{cat.label}
						</Button>
					))}
				</div>

				<ScrollArea className="h-[60vh]">
					<div className="space-y-1">
						<div className="grid grid-cols-[1fr_1fr_120px] gap-4 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b">
							<span>Action</span>
							<span>Shortcut</span>
							<span>Category</span>
						</div>
						{filteredActions.map(([action, def]) => (
							<ShortcutRow
								key={action}
								action={action}
								description={def.description}
								category={def.category}
								defaultShortcuts={"defaultShortcuts" in def ? def.defaultShortcuts ?? [] : []}
								isEditing={editingAction === action}
								onStartEdit={() => setEditingAction(action)}
								onStopEdit={() => setEditingAction(null)}
							/>
						))}
					</div>
				</ScrollArea>
			</div>
		</BasePage>
	);
}

function ShortcutRow({
	action,
	description,
	category,
	defaultShortcuts,
	isEditing,
	onStartEdit,
	onStopEdit,
}: {
	action: TAction;
	description: string;
	category: TActionCategory;
	defaultShortcuts: string[];
	isEditing: boolean;
	onStartEdit: () => void;
	onStopEdit: () => void;
}) {
	const customKeybindings = useKeybindingsStore((s) => s.keybindings);
	const [capturedKeys, setCapturedKeys] = useState<string | null>(null);

	const currentShortcut = capturedKeys ?? defaultShortcuts[0] ?? "—";

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();

			const parts: string[] = [];
			if (e.ctrlKey || e.metaKey) parts.push("ctrl");
			if (e.shiftKey) parts.push("shift");
			if (e.altKey) parts.push("alt");

			const key = e.key.toLowerCase();
			if (!["control", "shift", "alt", "meta"].includes(key)) {
				parts.push(key);
				const combo = parts.join("+");
				setCapturedKeys(combo);
				useKeybindingsStore.getState().updateKeybinding(combo as any, action);
				setTimeout(onStopEdit, 300);
			}
		},
		[action, onStopEdit],
	);

	return (
		<div
			className={cn(
				"grid grid-cols-[1fr_1fr_120px] gap-4 px-3 py-2 rounded hover:bg-accent/50 transition-colors items-center",
				isEditing && "bg-accent ring-1 ring-primary",
			)}
		>
			<span className="text-sm truncate">{description}</span>
			<div>
				{isEditing ? (
					<input
						autoFocus
						readOnly
						value="Press shortcut..."
						onKeyDown={handleKeyDown}
						onBlur={onStopEdit}
						className="text-xs bg-primary/10 text-primary font-mono rounded px-2 py-1 w-full outline-none"
					/>
				) : (
					<button
						type="button"
						onClick={onStartEdit}
						className="text-xs font-mono bg-muted/50 rounded px-2 py-1 hover:bg-muted transition-colors text-left"
					>
						{currentShortcut}
					</button>
				)}
			</div>
			<Badge variant="outline" className="text-[9px] px-1.5 py-0 justify-self-start">
				{category}
			</Badge>
		</div>
	);
}
