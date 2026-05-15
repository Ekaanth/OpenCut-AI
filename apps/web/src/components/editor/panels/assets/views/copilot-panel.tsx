"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { useCopilot } from "@/hooks/use-copilot";
import {
	COPILOT_PRESETS,
	type CopilotStep,
	type CopilotStepStatus,
} from "@/lib/copilot/copilot-types";

const STATUS_STYLES: Record<CopilotStepStatus, string> = {
	pending: "text-muted-foreground",
	running: "text-blue-500 font-medium",
	completed: "text-green-600",
	error: "text-red-500",
	cancelled: "text-yellow-600",
};

const STATUS_ICONS: Record<CopilotStepStatus, string> = {
	pending: "○",
	running: "●",
	completed: "✓",
	error: "✗",
	cancelled: "⊘",
};

export function CopilotPanel({ className }: { className?: string }) {
	const {
		plan,
		isPlanning,
		isExecuting,
		createPlan,
		executePlan,
		cancel,
		reset,
	} = useCopilot();
	const [goal, setGoal] = useState("");

	const handleCreatePlan = useCallback(async () => {
		if (!goal.trim()) return;
		await createPlan(goal);
	}, [createPlan, goal]);

	const completedCount =
		plan?.steps.filter((s) => s.status === "completed").length ?? 0;
	const totalCount = plan?.steps.length ?? 0;

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={SparklesIcon} className="size-4 text-primary" />
					<span className="text-xs font-medium">AI Co-Pilot</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Describe what you want. AI creates and executes a multi-step editing
					plan.
				</p>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-4">
					<div className="space-y-1.5">
						<span className="text-[10px] text-muted-foreground">
							What do you want to do?
						</span>
						<textarea
							className="w-full rounded border bg-transparent px-2 py-1.5 text-[10px] resize-none h-16 placeholder:text-muted-foreground"
							placeholder="e.g., Make this a 60-second reel with captions and music..."
							value={goal}
							onChange={(e) => setGoal(e.target.value)}
							disabled={isPlanning || isExecuting}
						/>
					</div>

					<div className="space-y-1">
						<span className="text-[8px] text-muted-foreground">
							Quick presets
						</span>
						<div className="flex flex-wrap gap-1">
							{COPILOT_PRESETS.map((preset) => (
								<Button
									key={preset.label}
									variant="ghost"
									size="sm"
									className="h-5 text-[7px] px-1.5"
									onClick={() => setGoal(preset.prompt)}
									disabled={isPlanning || isExecuting}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</div>

					{!plan && (
						<Button
							className="w-full"
							onClick={handleCreatePlan}
							disabled={isPlanning || !goal.trim()}
						>
							{isPlanning ? "Creating Plan..." : "Create Plan"}
						</Button>
					)}

					{plan && (
						<div className="space-y-3">
							<div className="rounded border p-2 space-y-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-medium">Plan</span>
									<span className="text-[8px] text-muted-foreground">
										~{plan.estimatedTime}
									</span>
								</div>
								<p className="text-[9px] text-muted-foreground">{plan.goal}</p>
								{totalCount > 0 && (
									<div className="flex items-center gap-1">
										<div className="flex-1 h-1 rounded bg-muted overflow-hidden">
											<div
												className="h-full bg-primary rounded transition-all"
												style={{
													width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
												}}
											/>
										</div>
										<span className="text-[8px] text-muted-foreground">
											{completedCount}/{totalCount}
										</span>
									</div>
								)}
							</div>

							<div className="space-y-0.5">
								{plan.steps.map((step) => (
									<StepRow key={step.id} step={step} />
								))}
							</div>

							<div className="flex gap-1">
								{!isExecuting && completedCount === 0 && (
									<Button
										className="flex-1 h-7 text-[10px]"
										onClick={executePlan}
									>
										Execute Plan
									</Button>
								)}
								{isExecuting && (
									<Button
										variant="destructive"
										className="flex-1 h-7 text-[10px]"
										onClick={cancel}
									>
										Cancel
									</Button>
								)}
								{!isExecuting && (
									<Button
										variant="outline"
										className="h-7 text-[10px]"
										onClick={reset}
									>
										New Plan
									</Button>
								)}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

function StepRow({ step }: { step: CopilotStep }) {
	return (
		<div
			className={cn(
				"rounded border px-2 py-1.5 flex items-center gap-2",
				step.status === "running" && "border-blue-500/30 bg-blue-500/5",
				step.status === "completed" && "border-green-500/20",
				step.status === "error" && "border-red-500/20",
			)}
		>
			<span className={cn("text-[10px] shrink-0", STATUS_STYLES[step.status])}>
				{STATUS_ICONS[step.status]}
			</span>
			<div className="flex-1 min-w-0">
				<p className="text-[10px] truncate">{step.description}</p>
				{step.error && (
					<p className="text-[8px] text-red-500 truncate">{step.error}</p>
				)}
			</div>
		</div>
	);
}
