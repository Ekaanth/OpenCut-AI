"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { PLATFORM_PRESETS, createQueueItem, type ExportQueueItem } from "@/lib/export-presets";
import { useEditor } from "@/hooks/use-editor";
import { toast } from "sonner";

export function BatchExportPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const [queue, setQueue] = useState<ExportQueueItem[]>([]);
	const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());

	const togglePreset = useCallback((id: string) => {
		setSelectedPresets((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const addToQueue = useCallback(() => {
		const items = Array.from(selectedPresets)
			.map((id) => PLATFORM_PRESETS.find((p) => p.id === id))
			.filter(Boolean)
			.map((preset) => createQueueItem(preset!));

		if (items.length === 0) {
			toast.error("Select at least one export preset");
			return;
		}

		setQueue((prev) => [...prev, ...items]);
		setSelectedPresets(new Set());
		toast.success(`Added ${items.length} exports to queue`);
	}, [selectedPresets]);

	const handleExportAll = useCallback(async () => {
		const queued = queue.filter((item) => item.status === "queued");
		if (queued.length === 0) return;

		for (const item of queued) {
			setQueue((prev) =>
				prev.map((q) =>
					q.id === item.id ? { ...q, status: "exporting", progress: 0, startedAt: Date.now() } : q,
				),
			);

			try {
				const preset = item.preset;
				const originalSettings = editor.project.getActive().settings;

				editor.project.updateSettings({
					settings: { canvasSize: preset.canvasSize },
					pushHistory: false,
				});

				await editor.project.export({
					options: {
						format: preset.format,
						quality: preset.quality,
					},
				});

				editor.project.updateSettings({
					settings: { canvasSize: originalSettings.canvasSize },
					pushHistory: false,
				});

				setQueue((prev) =>
					prev.map((q) =>
						q.id === item.id
							? { ...q, status: "completed", progress: 100, completedAt: Date.now() }
							: q,
					),
				);
			} catch (err) {
				setQueue((prev) =>
					prev.map((q) =>
						q.id === item.id
							? {
									...q,
									status: "error",
									error: err instanceof Error ? err.message : "Export failed",
									completedAt: Date.now(),
								}
							: q,
					),
				);
			}
		}

		toast.success("Batch export complete");
	}, [queue, editor]);

	const removeFromQueue = useCallback((id: string) => {
		setQueue((prev) => prev.filter((q) => q.id !== id));
	}, []);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Download04Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Batch Export</span>
					{queue.length > 0 && (
						<Badge variant="secondary" className="text-[8px] px-1 py-0">
							{queue.length}
						</Badge>
					)}
				</div>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-3">
					<div className="space-y-1.5">
						<span className="text-[10px] font-medium text-muted-foreground">Presets</span>
						<div className="grid grid-cols-2 gap-1">
							{PLATFORM_PRESETS.map((preset) => (
								<button
									key={preset.id}
									type="button"
									className={cn(
										"rounded border p-1.5 text-left transition-colors",
										selectedPresets.has(preset.id) ? "border-primary bg-primary/5" : "hover:bg-accent/50",
									)}
									onClick={() => togglePreset(preset.id)}
								>
									<span className="text-[10px] font-medium block">{preset.name}</span>
									<span className="text-[8px] text-muted-foreground">{preset.description}</span>
								</button>
							))}
						</div>
						<Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={addToQueue}>
							<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
							Add Selected to Queue
						</Button>
					</div>

					{queue.length > 0 && (
						<div className="space-y-1.5">
							<span className="text-[10px] font-medium text-muted-foreground">Queue</span>
							{queue.map((item) => (
								<div key={item.id} className="rounded border p-2 flex items-center gap-2">
									<div className="flex-1 min-w-0">
										<span className="text-[10px] font-medium block truncate">
											{item.preset.name}
										</span>
										<span className={cn(
											"text-[8px]",
											item.status === "completed" && "text-green-500",
											item.status === "error" && "text-destructive",
											item.status === "exporting" && "text-primary",
											item.status === "queued" && "text-muted-foreground",
										)}>
											{item.status === "queued" && "Queued"}
											{item.status === "exporting" && `Exporting ${item.progress}%`}
											{item.status === "completed" && "Completed"}
											{item.status === "error" && item.error}
										</span>
									</div>
									{item.status === "queued" && (
										<button
											type="button"
											onClick={() => removeFromQueue(item.id)}
											className="text-muted-foreground hover:text-destructive"
										>
											<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
										</button>
									)}
								</div>
							))}
							<Button size="sm" className="w-full" onClick={handleExportAll}>
								Export All ({queue.filter((q) => q.status === "queued").length})
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
