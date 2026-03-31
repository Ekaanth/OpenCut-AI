"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateBranchDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	currentBranch,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (name: string, description?: string) => void;
	currentBranch: string;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");

	const handleOpenChange = (open: boolean) => {
		if (open) {
			setName("");
			setDescription("");
			setError("");
		}
		onOpenChange(open);
	};

	const validate = (value: string): string => {
		if (!value.trim()) return "Branch name is required";
		if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/.test(value)) {
			return "Must start with letter/number, use only letters, numbers, hyphens, underscores";
		}
		return "";
	};

	const handleSubmit = () => {
		const err = validate(name);
		if (err) {
			setError(err);
			return;
		}
		onConfirm(name.trim(), description.trim() || undefined);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>New Branch</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					<div className="text-xs text-muted-foreground">
						Branching from <span className="font-medium text-foreground">{currentBranch}</span>
					</div>

					<div>
						<Label htmlFor="branch-name">Branch name</Label>
						<Input
							id="branch-name"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSubmit();
								}
							}}
							placeholder="e.g. social-cut, client-v2"
							className="mt-1"
							autoFocus
						/>
						{error && (
							<div className="text-xs text-destructive mt-1">{error}</div>
						)}
					</div>

					<div>
						<Label htmlFor="branch-desc" className="text-xs text-muted-foreground">
							Description (optional)
						</Label>
						<Input
							id="branch-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What is this branch for?"
							className="mt-1"
						/>
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>Create Branch</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
