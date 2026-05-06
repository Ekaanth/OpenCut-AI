"use client";

import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

export function UndoHistoryPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const history = editor.command.getHistory();
	const redoStack = editor.command.getRedoStack();

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Undo History</span>
				</div>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-0.5">
					{history.length === 0 && redoStack.length === 0 && (
						<p className="text-[10px] text-muted-foreground text-center py-4">
							No actions yet
						</p>
					)}

					{history.map((cmd, i) => (
						<button
							key={`hist-${i}`}
							type="button"
							className={cn(
								"w-full text-left rounded px-2 py-1 text-[10px] transition-colors",
								i === history.length - 1
									? "bg-primary/10 text-primary font-medium"
									: "hover:bg-accent/50 text-muted-foreground",
							)}
							onClick={() => editor.command.undoTo(i)}
						>
							<span className="text-[8px] text-muted-foreground mr-1">#{i + 1}</span>
							{cmd.getDescription()}
						</button>
					))}

					{redoStack.length > 0 && (
						<div className="border-t pt-1 mt-1">
							<span className="text-[8px] text-muted-foreground px-2">Redo stack</span>
							{redoStack.map((cmd, i) => (
								<button
									key={`redo-${i}`}
									type="button"
									className="w-full text-left rounded px-2 py-1 text-[10px] text-muted-foreground/50 hover:bg-accent/50 transition-colors"
									onClick={() => editor.command.redoTo(history.length + i + 1)}
								>
									<span className="text-[8px] text-muted-foreground mr-1">r#{i + 1}</span>
									{cmd.getDescription()}
								</button>
							))}
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
