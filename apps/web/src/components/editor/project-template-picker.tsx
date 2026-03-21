"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/constants/project-constants";

// ----- Types -----

interface ProjectTemplatePickerProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectTemplate: (template: ProjectTemplate) => void;
}

// ----- Icon map -----

const TEMPLATE_ICONS: Record<string, string> = {
	youtube: "▶",
	tiktok: "♪",
	podcast: "🎙",
	instagram: "◻",
	presentation: "📊",
	custom: "⚙",
};

// ----- Component -----

export function ProjectTemplatePicker({
	isOpen,
	onOpenChange,
	onSelectTemplate,
}: ProjectTemplatePickerProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const selectedTemplate = PROJECT_TEMPLATES.find((t) => t.id === selectedId);

	const handleSelect = () => {
		if (selectedTemplate) {
			onSelectTemplate(selectedTemplate);
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>What are you making?</DialogTitle>
					<DialogDescription>
						Pick a template to set up your project. You can change settings later.
					</DialogDescription>
				</DialogHeader>

				<DialogBody>
					<div className="grid grid-cols-2 gap-2">
						{PROJECT_TEMPLATES.map((template) => {
							const isSelected = selectedId === template.id;

							return (
								<Card
									key={template.id}
									className={cn(
										"cursor-pointer transition-all rounded-lg hover:bg-accent",
										isSelected && "ring-2 ring-primary",
									)}
									onClick={() => setSelectedId(template.id)}
								>
									<CardContent className="p-3">
										<div className="flex items-start gap-2.5">
											<span className="text-lg leading-none mt-0.5">
												{TEMPLATE_ICONS[template.icon] ?? "📹"}
											</span>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5">
													<span className="text-xs font-medium">
														{template.name}
													</span>
												</div>
												<p className="text-[10px] text-muted-foreground mt-0.5">
													{template.description}
												</p>
												<div className="flex items-center gap-1.5 mt-1.5">
													<Badge
														variant="secondary"
														className="text-[9px] px-1 py-0"
													>
														{template.canvas.width}×{template.canvas.height}
													</Badge>
													<Badge
														variant="secondary"
														className="text-[9px] px-1 py-0"
													>
														{template.fps} fps
													</Badge>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>

					{/* Tips for selected template */}
					{selectedTemplate && (
						<div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
							<p className="text-[11px] font-medium text-muted-foreground mb-1.5">
								Suggested workflow
							</p>
							<ol className="flex flex-col gap-1">
								{selectedTemplate.tips.map((tip, index) => (
									<li
										key={tip}
										className="flex items-start gap-2 text-[11px] text-muted-foreground"
									>
										<span className="text-[10px] font-bold text-primary mt-px shrink-0">
											{index + 1}.
										</span>
										{tip}
									</li>
								))}
							</ol>
						</div>
					)}
				</DialogBody>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Skip
					</Button>
					<Button
						onClick={handleSelect}
						disabled={!selectedTemplate}
					>
						Create project
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
