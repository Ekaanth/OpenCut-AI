"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";

interface SubTab {
	key: string;
	label: string;
	content: React.ReactNode;
}

/**
 * A view with sub-tabs inside a single sidebar panel.
 * Used to consolidate related features under one sidebar icon.
 */
export function SubTabView({
	tabs,
	defaultTab,
}: {
	tabs: SubTab[];
	defaultTab?: string;
}) {
	const [active, setActive] = useState(defaultTab ?? tabs[0]?.key ?? "");
	const current = tabs.find((t) => t.key === active) ?? tabs[0];

	return (
		<div className="flex flex-col h-full">
			{/* Sub-tab bar */}
			<div className="flex border-b border-border shrink-0">
				{tabs.map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => setActive(tab.key)}
						className={cn(
							"flex-1 px-2 py-2 text-[11px] font-medium transition-colors border-b-2",
							active === tab.key
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>
			{/* Content */}
			<div className="flex-1 min-h-0 overflow-hidden">
				{current?.content}
			</div>
		</div>
	);
}
