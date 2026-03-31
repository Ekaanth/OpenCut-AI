"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAssetsPanelStore, tabs, TAB_KEYS, type Tab } from "@/stores/assets-panel-store";
import { useVersionStore } from "@/stores/version-store";
import { ACTIONS, type TAction } from "@/lib/actions/definitions";
import { invokeAction } from "@/lib/actions/registry";

// ─── Command registry ─────────────────────────────────────────────────────

interface Command {
	id: string;
	label: string;
	description?: string;
	category: string;
	keywords: string[];
	action: () => void;
}

function buildCommands(
	setActiveTab: (tab: Tab) => void,
	openCommitDialog: () => void,
): Command[] {
	const commands: Command[] = [];

	// 1. Sidebar tabs — navigate to any panel
	for (const key of TAB_KEYS) {
		const tab = tabs[key];
		commands.push({
			id: `tab-${key}`,
			label: tab.label,
			description: `Open ${tab.label} panel`,
			category: "Navigate",
			keywords: [key, tab.label.toLowerCase(), "panel", "tab", "open"],
			action: () => setActiveTab(key),
		});
	}

	// 2. Version control actions
	commands.push(
		{
			id: "vc-commit",
			label: "Commit Changes",
			description: "Save a version snapshot",
			category: "Version Control",
			keywords: ["commit", "save", "version", "snapshot", "git"],
			action: openCommitDialog,
		},
		{
			id: "vc-history",
			label: "Version History",
			description: "View commit history (in Settings)",
			category: "Version Control",
			keywords: ["history", "versions", "log", "git", "timeline", "commits"],
			action: () => setActiveTab("settings"),
		},
		{
			id: "vc-branch",
			label: "Switch Branch",
			description: "Open branch switcher",
			category: "Version Control",
			keywords: ["branch", "switch", "checkout", "git"],
			action: () => {
				setActiveTab("settings");
			},
		},
		{
			id: "vc-diff",
			label: "View Changes",
			description: "Diff uncommitted changes vs last commit",
			category: "Version Control",
			keywords: ["diff", "changes", "compare", "modifications"],
			action: () => setActiveTab("settings"),
		},
		{
			id: "vc-merge",
			label: "Merge Branches",
			description: "Merge another branch into current",
			category: "Version Control",
			keywords: ["merge", "combine", "branch", "git"],
			action: () => setActiveTab("settings"),
		},
		{
			id: "vc-stash",
			label: "Stash Changes",
			description: "Temporarily shelve uncommitted changes",
			category: "Version Control",
			keywords: ["stash", "shelve", "save", "temporary"],
			action: () => setActiveTab("settings"),
		},
	);

	// 3. Editor actions (from ACTIONS registry)
	for (const [key, def] of Object.entries(ACTIONS)) {
		const shortcut = (def as { defaultShortcuts?: readonly string[] }).defaultShortcuts?.[0];
		commands.push({
			id: `action-${key}`,
			label: def.description,
			description: shortcut ? `Shortcut: ${shortcut}` : undefined,
			category: capitalize(def.category),
			keywords: [
				key.replace(/-/g, " "),
				def.description.toLowerCase(),
				def.category,
			],
			action: () => {
				try {
					invokeAction(key as TAction);
				} catch {
					// Some actions need specific context
				}
			},
		});
	}

	// 4. Features / info commands
	commands.push(
		{
			id: "feature-ai-studio",
			label: "AI Studio",
			description: "AI-powered video editing tools",
			category: "Features",
			keywords: ["ai", "studio", "smart", "auto", "generate", "magic"],
			action: () => setActiveTab("ai"),
		},
		{
			id: "feature-captions",
			label: "Captions & Transcript",
			description: "Auto-generate subtitles and transcripts",
			category: "Features",
			keywords: ["caption", "subtitle", "transcript", "speech", "text"],
			action: () => setActiveTab("captions"),
		},
		{
			id: "feature-visuals",
			label: "Effects, Filters & Adjustment",
			description: "Visual effects, color grading, and adjustments",
			category: "Features",
			keywords: ["effect", "filter", "color", "visual", "grade", "adjustment", "brightness", "contrast"],
			action: () => setActiveTab("visuals"),
		},
		{
			id: "feature-audio",
			label: "Audio: Sounds, Voiceover & Podcast",
			description: "Sound effects, AI voiceover, and podcast clips",
			category: "Features",
			keywords: ["sound", "voice", "voiceover", "tts", "podcast", "clip", "audio", "music"],
			action: () => setActiveTab("audio"),
		},
		{
			id: "feature-elements",
			label: "Elements: Stickers & Overlays",
			description: "Stickers, emojis, and overlay transitions",
			category: "Features",
			keywords: ["sticker", "emoji", "overlay", "transition", "element"],
			action: () => setActiveTab("elements"),
		},
		{
			id: "feature-brand",
			label: "Brand Kit",
			description: "Brand colors, fonts, and templates",
			category: "Features",
			keywords: ["brand", "kit", "template", "logo", "identity"],
			action: () => setActiveTab("brandkit"),
		},
		{
			id: "feature-factcheck",
			label: "Fact Check",
			description: "AI-powered claim verification (in Settings)",
			category: "Features",
			keywords: ["fact", "check", "verify", "claim", "accuracy"],
			action: () => setActiveTab("settings"),
		},
		{
			id: "feature-export",
			label: "Export Video",
			description: "Render and download your video",
			category: "Features",
			keywords: ["export", "render", "download", "mp4", "video", "output"],
			action: () => {
				// Export is in the header — just indicate it
			},
		},
	);

	return commands;
}

// ─── Fuzzy search ─────────────────────────────────────────────────────────

function searchCommands(commands: Command[], query: string): Command[] {
	if (!query.trim()) return commands;

	const lower = query.toLowerCase();
	const terms = lower.split(/\s+/);

	return commands
		.map((cmd) => {
			const haystack = [
				cmd.label.toLowerCase(),
				cmd.description?.toLowerCase() ?? "",
				cmd.category.toLowerCase(),
				...cmd.keywords,
			].join(" ");

			let score = 0;
			for (const term of terms) {
				if (haystack.includes(term)) {
					score += 1;
					// Bonus for label match
					if (cmd.label.toLowerCase().includes(term)) score += 2;
					// Bonus for exact keyword match
					if (cmd.keywords.includes(term)) score += 1;
				}
			}
			return { cmd, score };
		})
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((r) => r.cmd);
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Component ────────────────────────────────────────────────────────────

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const { setActiveTab } = useAssetsPanelStore();
	const { openCommitDialog } = useVersionStore();

	const allCommands = useMemo(
		() => buildCommands(setActiveTab, openCommitDialog),
		[setActiveTab, openCommitDialog],
	);

	const results = useMemo(
		() => searchCommands(allCommands, query),
		[allCommands, query],
	);

	// Reset state when opening
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIdx(0);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	// Keep selection in bounds
	useEffect(() => {
		setSelectedIdx(0);
	}, [query]);

	// Scroll selected into view
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const selected = list.children[selectedIdx] as HTMLElement;
		if (selected) {
			selected.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIdx]);

	// Global keyboard listener for Cmd+Shift+P
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
			if (e.key === "Escape" && open) {
				setOpen(false);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	const execute = useCallback(
		(cmd: Command) => {
			cmd.action();
			setOpen(false);
		},
		[],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIdx((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (results[selectedIdx]) {
					execute(results[selectedIdx]);
				}
			}
		},
		[results, selectedIdx, execute],
	);

	if (!open) return null;

	// Group results by category
	const grouped: { category: string; items: Command[] }[] = [];
	const seen = new Set<string>();
	for (const cmd of results) {
		if (!seen.has(cmd.category)) {
			seen.add(cmd.category);
			grouped.push({ category: cmd.category, items: [] });
		}
		grouped.find((g) => g.category === cmd.category)!.items.push(cmd);
	}

	let flatIdx = 0;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-50 bg-black/40"
				onClick={() => setOpen(false)}
			/>

			{/* Palette */}
			<div className="fixed inset-x-0 top-[15%] z-50 mx-auto w-full max-w-lg">
				<div className="rounded-lg border border-border bg-background shadow-2xl overflow-hidden">
					{/* Search input */}
					<div className="flex items-center gap-2 px-4 py-3 border-b border-border">
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							className="text-muted-foreground flex-shrink-0"
						>
							<circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
							<path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Search features, actions, panels..."
							className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
							autoComplete="off"
							spellCheck={false}
						/>
						<kbd className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5 rounded border border-border/50 bg-muted/30">
							ESC
						</kbd>
					</div>

					{/* Results */}
					<div
						ref={listRef}
						className="max-h-[50vh] overflow-y-auto py-1"
					>
						{results.length === 0 ? (
							<div className="px-4 py-6 text-center text-sm text-muted-foreground/60">
								No results for &quot;{query}&quot;
							</div>
						) : (
							grouped.map((group) => (
								<div key={group.category}>
									<div className="px-4 py-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
										{group.category}
									</div>
									{group.items.map((cmd) => {
										const idx = flatIdx++;
										return (
											<button
												key={cmd.id}
												type="button"
												className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 text-sm transition-colors ${
													idx === selectedIdx
														? "bg-primary/10 text-foreground"
														: "text-foreground/80 hover:bg-muted/50"
												}`}
												onClick={() => execute(cmd)}
												onMouseEnter={() => setSelectedIdx(idx)}
											>
												<div className="min-w-0">
													<div className="truncate font-medium">
														{cmd.label}
													</div>
													{cmd.description && (
														<div className="text-xs text-muted-foreground/60 truncate">
															{cmd.description}
														</div>
													)}
												</div>
												{cmd.description?.startsWith("Shortcut:") && (
													<kbd className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 flex-shrink-0">
														{cmd.description.replace("Shortcut: ", "")}
													</kbd>
												)}
											</button>
										);
									})}
								</div>
							))
						)}
					</div>

					{/* Footer hint */}
					<div className="px-4 py-2 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground/50">
						<span>
							<kbd className="px-1 py-0.5 rounded border border-border/50 bg-muted/30">
								Up/Down
							</kbd>{" "}
							navigate
						</span>
						<span>
							<kbd className="px-1 py-0.5 rounded border border-border/50 bg-muted/30">
								Enter
							</kbd>{" "}
							select
						</span>
						<span>
							<kbd className="px-1 py-0.5 rounded border border-border/50 bg-muted/30">
								Esc
							</kbd>{" "}
							close
						</span>
					</div>
				</div>
			</div>
		</>
	);
}
