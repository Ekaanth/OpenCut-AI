"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { TextEditingPanel } from "@/components/editor/ai/text-editing-panel";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";

type RightTab = "transcript" | "properties";

/**
 * Tabbed right panel that shows both the Transcript editor and the
 * Properties inspector. When a transcript exists AND an element is
 * selected, both tabs are available. Otherwise only the relevant one
 * shows (no tabs needed).
 */
export function RightPanel({ className }: { className?: string }) {
	const hasTranscript = useTranscriptStore((s) => s.segments.length > 0);
	const { selectedElements } = useElementSelection();
	const hasSelection = selectedElements.length > 0;

	// Auto-switch to properties when an element is selected
	const [activeTab, setActiveTab] = useState<RightTab>("transcript");

	// Show tabs only when both transcript and timeline content exist
	const showTabs = hasTranscript;

	// If no transcript, always show properties
	if (!hasTranscript) {
		return (
			<div className={cn("panel bg-background h-full rounded-sm border overflow-hidden", className)}>
				<PropertiesPanel />
			</div>
		);
	}

	// If transcript but no tabs needed (single view)
	if (!showTabs) {
		return (
			<div className={cn("h-full", className)}>
				<TextEditingPanel className="size-full" />
			</div>
		);
	}

	return (
		<div className={cn("panel bg-background h-full rounded-sm border overflow-hidden flex flex-col", className)}>
			{/* Tab bar */}
			<div className="flex items-center border-b shrink-0">
				<TabButton
					active={activeTab === "transcript"}
					onClick={() => setActiveTab("transcript")}
				>
					Transcript
				</TabButton>
				<TabButton
					active={activeTab === "properties"}
					onClick={() => setActiveTab("properties")}
					badge={hasSelection}
				>
					Properties
				</TabButton>
			</div>

			{/* Tab content */}
			<div className="flex-1 min-h-0 overflow-hidden">
				{activeTab === "transcript" ? (
					<TextEditingPanel className="size-full" />
				) : (
					<PropertiesPanel />
				)}
			</div>
		</div>
	);
}

function TabButton({
	active,
	onClick,
	children,
	badge,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
	badge?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5",
				active
					? "border-primary text-foreground"
					: "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
			)}
		>
			{children}
			{badge && (
				<span className="size-1.5 rounded-full bg-primary shrink-0" />
			)}
		</button>
	);
}
