"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/utils/ui";
import {
	TAB_KEYS,
	tabs,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";

export function TabBar() {
	const { activeTab, setActiveTab } = useAssetsPanelStore();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [showTopFade, setShowTopFade] = useState(false);
	const [showBottomFade, setShowBottomFade] = useState(false);

	const checkScrollPosition = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopFade(scrollTop > 0);
		setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1);
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

	return (
		<div className="relative flex">
			<div
				ref={scrollRef}
				className="scrollbar-hidden relative flex size-full flex-col items-center justify-start gap-5 overflow-y-auto px-4 py-4"
			>
				{TAB_KEYS.map((tabKey) => {
					const tab = tabs[tabKey];
					return (
						<Tooltip key={tabKey} delayDuration={10}>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label={tab.label}
									className={cn(
										"flex cursor-pointer flex-col items-center gap-0.5 [&>svg]:size-4.5! opacity-100 hover:opacity-75",
										activeTab === tabKey
											? "text-primary !opacity-100"
											: "text-muted-foreground",
									)}
									onClick={() => setActiveTab(tabKey)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											setActiveTab(tabKey);
										}
									}}
								>
									<tab.icon className=" " />
								</button>
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

			<FadeOverlay direction="top" show={showTopFade} />
			<FadeOverlay direction="bottom" show={showBottomFade} />
		</div>
	);
}

function FadeOverlay({
	direction,
	show,
}: {
	direction: "top" | "bottom";
	show: boolean;
}) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute right-0 left-0 h-6",
				direction === "top" && show
					? "from-panel top-0 bg-gradient-to-b to-transparent"
					: "from-panel bottom-0 bg-gradient-to-t to-transparent",
			)}
		/>
	);
}
