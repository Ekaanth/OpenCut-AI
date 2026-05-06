"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { GridIcon } from "@hugeicons/core-free-icons";
import {
	BUILTIN_TEMPLATES,
	TEMPLATE_CATEGORIES,
	type ProjectTemplate,
} from "@/lib/templates/template-gallery";
import { useEditor } from "@/hooks/use-editor";
import { toast } from "sonner";

export function TemplateGalleryPanel({ className }: { className?: string }) {
	const editor = useEditor();
	const [category, setCategory] = useState<string>("all");
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		let templates = BUILTIN_TEMPLATES;
		if (category !== "all") {
			templates = templates.filter((t) => t.category === category);
		}
		if (search.trim()) {
			const q = search.toLowerCase();
			templates = templates.filter(
				(t) =>
					t.name.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q) ||
					t.tags.some((tag) => tag.includes(q)),
			);
		}
		return templates;
	}, [category, search]);

	const applyTemplate = useCallback(
		(template: ProjectTemplate) => {
			const canvasSizes: Record<string, { width: number; height: number }> = {
				"16:9": { width: 1920, height: 1080 },
				"9:16": { width: 1080, height: 1920 },
				"1:1": { width: 1080, height: 1080 },
				"4:5": { width: 1080, height: 1350 },
			};

			const size = canvasSizes[template.aspectRatio];
			if (size) {
				editor.project.updateSettings({
					settings: { canvasSize: size },
					pushHistory: false,
				});
			}

			for (const track of template.tracks) {
				editor.timeline.addTrack({ type: track.type as any });
			}

			toast.success(`Applied "${template.name}" template`);
		},
		[editor],
	);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div className="px-4 py-3 border-b space-y-2">
				<div className="flex items-center gap-2">
					<HugeiconsIcon icon={GridIcon} className="size-4 text-primary" />
					<span className="text-xs font-medium">Templates</span>
				</div>
				<p className="text-[10px] text-muted-foreground">
					Start with a pre-built project template.
				</p>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-3 space-y-3">
					<input
						className="w-full rounded border bg-transparent px-2 py-1 text-[10px] placeholder:text-muted-foreground"
						placeholder="Search templates..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>

					<div className="flex flex-wrap gap-1">
						<Button
							variant={category === "all" ? "secondary" : "ghost"}
							size="sm"
							className="h-5 text-[8px] px-1.5"
							onClick={() => setCategory("all")}
						>
							All
						</Button>
						{TEMPLATE_CATEGORIES.map((cat) => (
							<Button
								key={cat.value}
								variant={category === cat.value ? "secondary" : "ghost"}
								size="sm"
								className="h-5 text-[8px] px-1.5"
								onClick={() => setCategory(cat.value)}
							>
								{cat.label}
							</Button>
						))}
					</div>

					{filtered.map((template) => (
						<button
							key={template.id}
							type="button"
							className="w-full rounded border p-2 text-left hover:bg-accent/50 transition-colors"
							onClick={() => applyTemplate(template)}
						>
							<div className="flex items-start justify-between">
								<div>
									<span className="text-[10px] font-medium block">
										{template.name}
									</span>
									<span className="text-[8px] text-muted-foreground block mt-0.5">
										{template.description}
									</span>
								</div>
								<span className="text-[7px] text-muted-foreground bg-accent/50 rounded px-1 py-0.5">
									{template.aspectRatio}
								</span>
							</div>
							<div className="flex items-center gap-1 mt-1.5">
								<span className="text-[7px] text-muted-foreground">
									~{template.estimatedDuration}s
								</span>
								<span className="text-[7px] text-muted-foreground">|</span>
								<span className="text-[7px] text-muted-foreground">
									{template.tracks.length} tracks
								</span>
								<span className="text-[7px] text-muted-foreground">|</span>
								{template.tags.slice(0, 3).map((tag) => (
									<span
										key={tag}
										className="text-[7px] bg-primary/10 text-primary rounded px-1"
									>
										{tag}
									</span>
								))}
							</div>
						</button>
					))}

					{filtered.length === 0 && (
						<p className="text-[10px] text-muted-foreground text-center py-4">
							No templates match your search.
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
