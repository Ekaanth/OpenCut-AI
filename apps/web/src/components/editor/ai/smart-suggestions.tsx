"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Cancel01Icon,
	Tick01Icon,
	Alert01Icon,
	InformationCircleIcon,
	ArrowUp01Icon,
} from "@hugeicons/core-free-icons";

// ----- Types -----

export type SuggestionSeverity = "warning" | "improvement" | "info";

export interface AISuggestion {
	id: string;
	severity: SuggestionSeverity;
	message: string;
	description?: string;
	actionLabel?: string;
	timestamp: number;
}

interface SmartSuggestionsProps {
	suggestions: AISuggestion[];
	onApply: (id: string) => void;
	onDismiss: (id: string) => void;
	maxVisible?: number;
	autoDismissMs?: number;
	className?: string;
}

// ----- Helpers -----

const SEVERITY_CONFIG: Record<
	SuggestionSeverity,
	{
		bg: string;
		border: string;
		iconColor: string;
		icon: typeof Alert01Icon;
	}
> = {
	warning: {
		bg: "bg-yellow-500/5 dark:bg-yellow-500/10",
		border: "border-yellow-500/30",
		iconColor: "text-yellow-500",
		icon: Alert01Icon,
	},
	improvement: {
		bg: "bg-blue-500/5 dark:bg-blue-500/10",
		border: "border-blue-500/30",
		iconColor: "text-blue-500",
		icon: ArrowUp01Icon,
	},
	info: {
		bg: "bg-muted/50",
		border: "border-border",
		iconColor: "text-muted-foreground",
		icon: InformationCircleIcon,
	},
};

// ----- Component -----

export function SmartSuggestions({
	suggestions,
	onApply,
	onDismiss,
	maxVisible = 3,
	autoDismissMs = 30000,
	className,
}: SmartSuggestionsProps) {
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

	const visibleSuggestions = useMemo(() => {
		return suggestions
			.filter((s) => !dismissedIds.has(s.id))
			.slice(0, maxVisible);
	}, [suggestions, dismissedIds, maxVisible]);

	const queuedCount = useMemo(() => {
		const total = suggestions.filter((s) => !dismissedIds.has(s.id)).length;
		return Math.max(0, total - maxVisible);
	}, [suggestions, dismissedIds, maxVisible]);

	const handleDismiss = useCallback(
		(id: string) => {
			setDismissedIds((prev) => new Set([...prev, id]));
			onDismiss(id);
		},
		[onDismiss],
	);

	// Auto-dismiss timer
	useEffect(() => {
		if (autoDismissMs <= 0) return;

		const timers: ReturnType<typeof setTimeout>[] = [];

		for (const suggestion of visibleSuggestions) {
			const age = Date.now() - suggestion.timestamp;
			const remaining = autoDismissMs - age;

			if (remaining <= 0) {
				handleDismiss(suggestion.id);
			} else {
				const timer = setTimeout(() => {
					handleDismiss(suggestion.id);
				}, remaining);
				timers.push(timer);
			}
		}

		return () => {
			for (const timer of timers) {
				clearTimeout(timer);
			}
		};
	}, [visibleSuggestions, autoDismissMs, handleDismiss]);

	if (visibleSuggestions.length === 0) return null;

	return (
		<div
			className={cn(
				"fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80",
				className,
			)}
		>
			{visibleSuggestions.map((suggestion) => {
				const config = SEVERITY_CONFIG[suggestion.severity];

				return (
					<Card
						key={suggestion.id}
						className={cn(
							"rounded-lg animate-in slide-in-from-right duration-300",
							config.bg,
							config.border,
						)}
					>
						<CardContent className="p-3">
							<div className="flex items-start gap-2.5">
								<HugeiconsIcon
									icon={config.icon}
									className={cn("size-4 mt-0.5 shrink-0", config.iconColor)}
								/>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium leading-tight">
										{suggestion.message}
									</p>
									{suggestion.description && (
										<p className="text-xs text-muted-foreground mt-1">
											{suggestion.description}
										</p>
									)}
									<div className="flex items-center gap-2 mt-2">
										<Button
											variant="default"
											size="sm"
											onClick={() => {
												onApply(suggestion.id);
												handleDismiss(suggestion.id);
											}}
											className="h-6 text-xs"
										>
											<HugeiconsIcon
												icon={Tick01Icon}
												className="size-3 mr-1"
											/>
											{suggestion.actionLabel ?? "Apply"}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDismiss(suggestion.id)}
											className="h-6 text-xs text-muted-foreground"
										>
											<HugeiconsIcon
												icon={Cancel01Icon}
												className="size-3 mr-1"
											/>
											Dismiss
										</Button>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleDismiss(suggestion.id)}
									className="size-5 shrink-0 -mt-0.5 -mr-1"
									aria-label="Close"
								>
									<HugeiconsIcon
										icon={Cancel01Icon}
										className="size-3"
									/>
								</Button>
							</div>
						</CardContent>
					</Card>
				);
			})}

			{queuedCount > 0 && (
				<p className="text-[10px] text-muted-foreground text-center">
					+{queuedCount} more suggestion{queuedCount !== 1 ? "s" : ""}
				</p>
			)}
		</div>
	);
}
