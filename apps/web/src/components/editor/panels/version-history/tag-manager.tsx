"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEditor } from "@/hooks/use-editor";
import type { Tag, TagType } from "@/types/version";

const TAG_TYPE_COLORS: Record<TagType, string> = {
	milestone: "bg-purple-500/10 text-purple-400 border-purple-500/20",
	review: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	export: "bg-green-500/10 text-green-400 border-green-500/20",
	custom: "bg-primary/10 text-primary border-primary/20",
};

const TAG_TYPE_LABELS: Record<TagType, string> = {
	milestone: "Milestone",
	review: "Review",
	export: "Export",
	custom: "Custom",
};

export function TagBadge({ tag }: { tag: Tag }) {
	return (
		<span
			className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${TAG_TYPE_COLORS[tag.type]}`}
			title={tag.note || `${TAG_TYPE_LABELS[tag.type]} tag`}
		>
			{tag.name}
		</span>
	);
}

export function TagManager({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const [tags, setTags] = useState<Tag[]>([]);
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState<TagType>("custom");
	const [newNote, setNewNote] = useState("");
	const [error, setError] = useState("");

	const loadTags = useCallback(async () => {
		const list = await editor.version.listTags();
		setTags(list);
	}, [editor.version]);

	useEffect(() => {
		if (isOpen) loadTags();
	}, [isOpen, loadTags]);

	const handleCreate = useCallback(async () => {
		if (!newName.trim()) {
			setError("Tag name is required");
			return;
		}
		try {
			await editor.version.createTag(
				newName.trim(),
				undefined,
				newType,
				newNote.trim() || undefined,
			);
			setNewName("");
			setNewNote("");
			setError("");
			await loadTags();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create tag");
		}
	}, [newName, newType, newNote, editor.version, loadTags]);

	const handleDelete = useCallback(
		async (name: string) => {
			await editor.version.deleteTag(name);
			await loadTags();
		},
		[editor.version, loadTags],
	);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Tags & Milestones</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					{/* Create new tag */}
					<div className="space-y-2">
						<Label className="text-xs">Create Tag</Label>
						<Input
							value={newName}
							onChange={(e) => {
								setNewName(e.target.value);
								setError("");
							}}
							placeholder="Tag name (e.g. rough-cut, v1-final)"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreate();
							}}
						/>
						<div className="flex gap-1">
							{(Object.keys(TAG_TYPE_LABELS) as TagType[]).map((type) => (
								<button
									key={type}
									type="button"
									className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
										newType === type
											? TAG_TYPE_COLORS[type]
											: "border-border text-muted-foreground hover:text-foreground"
									}`}
									onClick={() => setNewType(type)}
								>
									{TAG_TYPE_LABELS[type]}
								</button>
							))}
						</div>
						<Input
							value={newNote}
							onChange={(e) => setNewNote(e.target.value)}
							placeholder="Note (optional)"
							className="text-xs"
						/>
						{error && <div className="text-xs text-destructive">{error}</div>}
						<Button size="sm" onClick={handleCreate} className="w-full">
							Create Tag on HEAD
						</Button>
					</div>

					<Separator />

					{/* Existing tags */}
					<div>
						<Label className="text-xs text-muted-foreground">Existing Tags</Label>
						{tags.length === 0 ? (
							<div className="text-xs text-muted-foreground/60 text-center py-3">
								No tags yet
							</div>
						) : (
							<div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
								{tags.map((tag) => (
									<div
										key={tag.id}
										className="flex items-center justify-between py-1"
									>
										<div className="flex items-center gap-2 min-w-0">
											<TagBadge tag={tag} />
											{tag.note && (
												<span className="text-[10px] text-muted-foreground/60 truncate">
													{tag.note}
												</span>
											)}
										</div>
										<button
											type="button"
											className="text-[10px] text-muted-foreground/60 hover:text-destructive px-1"
											onClick={() => handleDelete(tag.name)}
										>
											x
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
