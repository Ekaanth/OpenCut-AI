"use client";

import { useState } from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";
import { getSectionTitle, groupAndOrderChanges } from "../utils";
import type { Change } from "../utils";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";

function buildMarkdown({
	description,
	changes,
}: {
	description?: string;
	changes: Change[];
}): string {
	const lines: string[] = [];

	if (description) {
		lines.push(description, "");
	}

	const { grouped, orderedTypes } = groupAndOrderChanges({ changes });

	for (const type of orderedTypes) {
		lines.push(`## ${getSectionTitle(type)}`);
		for (const change of grouped[type]) {
			lines.push(`- ${change.text}`);
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function CopyMarkdownButton({
	description,
	changes,
}: {
	description?: string;
	changes: Change[];
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const markdown = buildMarkdown({ description, changes });
		await navigator.clipboard.writeText(markdown);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			size="sm"
			variant="text"
			onClick={handleCopy}
			className={cn("flex items-center gap-1.5", copied && "!text-green-500 pointer-events-none")}
			title="Copy as markdown"
		>
			{copied ? (
				<CheckIcon className="size-4" />
			) : (
				<ClipboardIcon className="size-4" />
			)}
			{copied ? "Copied!" : "Copy markdown"}
		</Button>
	);
}
