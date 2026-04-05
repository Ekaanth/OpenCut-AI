"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface OwnershipDialogProps {
	onConfirm: () => void;
	onCancel: () => void;
}

export function OwnershipDialog({ onConfirm, onCancel }: OwnershipDialogProps) {
	const [checks, setChecks] = useState([false, false, false]);
	const allChecked = checks.every(Boolean);

	const toggle = (i: number) =>
		setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

	const labels = [
		"I own or have rights to this video",
		"I am authorized to create derivative works",
		"I understand OpenCutAI does not verify ownership",
	];

	return (
		<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-4">
			<h3 className="text-sm font-semibold text-yellow-400">Content Ownership Confirmation</h3>
			<p className="text-xs text-muted-foreground">
				By proceeding, you confirm that:
			</p>
			<div className="space-y-2">
				{labels.map((label, i) => (
					<label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
						<input
							type="checkbox"
							checked={checks[i]}
							onChange={() => toggle(i)}
							className="rounded border-muted-foreground"
						/>
						{label}
					</label>
				))}
			</div>
			<div className="flex gap-2 justify-end">
				<Button variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Button size="sm" disabled={!allChecked} onClick={onConfirm}>
					I Confirm & Proceed
				</Button>
			</div>
		</div>
	);
}
