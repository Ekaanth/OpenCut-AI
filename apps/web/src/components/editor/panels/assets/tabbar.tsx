"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import {
	TAB_KEYS,
	tabs,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";

export function TabBar() {
	const { activeTab, setActiveTab } = useAssetsPanelStore();
	const [showTopArrow, setShowTopArrow] = useState(false);
	const [showBottomArrow, setShowBottomArrow] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const checkScrollPosition = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopArrow(scrollTop > 4);
		setShowBottomArrow(scrollTop < scrollHeight - clientHeight - 4);
	}, []);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		checkScrollPosition();
		element.addEventListener("scroll", checkScrollPosition);

		const resizeObserver = new ResizeObserver(checkScrollPosition);
		resizeObserver.observe(element);

		return () => {
			element.removeEventListener("scroll", checkScrollPosition);
			resizeObserver.disconnect();
		};
	}, [checkScrollPosition]);

	const scrollBy = useCallback((direction: "up" | "down") => {
		const element = scrollRef.current;
		if (!element) return;
		element.scrollBy({
			top: direction === "up" ? -120 : 120,
			behavior: "smooth",
		});
	}, []);

	return (
		<div className="relative flex flex-col">
			{/* Scroll up button */}
			<div
				className={cn(
					"shrink-0 flex items-center justify-center transition-all duration-200",
					showTopArrow ? "h-6 opacity-100" : "h-0 opacity-0 overflow-hidden",
				)}
			>
				<button
					type="button"
					onClick={() => scrollBy("up")}
					className="flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					aria-label="Scroll up for more tabs"
				>
					<svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
						<path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
			</div>

			{/* Tab icons */}
			<div
				ref={scrollRef}
				className="scrollbar-hidden relative flex flex-1 min-h-0 p-2 flex-col items-center justify-start gap-1.5 overflow-y-auto"
			>
				{TAB_KEYS.map((tabKey) => {
					const tab = tabs[tabKey];
					return (
						<Tooltip key={tabKey} delayDuration={10}>
							<TooltipTrigger asChild>
								<Button
									variant={activeTab === tabKey ? "secondary" : "text"}
									aria-label={tab.label}
									className={cn(
										"flex-col !p-1.5 !rounded-sm !h-auto [&_svg]:size-4.5 shrink-0",
										activeTab !== tabKey &&
											"border border-transparent text-muted-foreground",
									)}
									onClick={() => setActiveTab(tabKey)}
								>
									<tab.icon />
								</Button>
							</TooltipTrigger>
							<TooltipContent
								side="right"
								align="center"
								variant="sidebar"
								sideOffset={8}
							>
								<div className="text-foreground text-sm leading-none font-medium">
									{tab.label}
								</div>
							</TooltipContent>
						</Tooltip>
					);
				})}
			</div>

			{/* Scroll down button */}
			<div
				className={cn(
					"shrink-0 flex items-center justify-center transition-all duration-200",
					showBottomArrow ? "h-6 opacity-100" : "h-0 opacity-0 overflow-hidden",
				)}
			>
				<button
					type="button"
					onClick={() => scrollBy("down")}
					className="flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					aria-label="Scroll down for more tabs"
				>
					<svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
						<path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
			</div>
		</div>
	);
}
