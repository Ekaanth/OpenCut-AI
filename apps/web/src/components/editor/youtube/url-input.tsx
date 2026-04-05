"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

const YT_REGEX =
	/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

interface YouTubeUrlInputProps {
	onSubmit: (url: string) => void;
	disabled?: boolean;
}

export function YouTubeUrlInput({ onSubmit, disabled }: YouTubeUrlInputProps) {
	const [url, setUrl] = useState("");
	const isValid = YT_REGEX.test(url);

	const handlePaste = (e: React.ClipboardEvent) => {
		const pasted = e.clipboardData.getData("text");
		if (YT_REGEX.test(pasted)) {
			e.preventDefault();
			setUrl(pasted);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && isValid && !disabled) {
			e.preventDefault();
			onSubmit(url);
		}
	};

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium text-foreground">YouTube Video URL</label>
			<div className="flex gap-2">
				<input
					type="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onPaste={handlePaste}
					onKeyDown={handleKeyDown}
					placeholder="https://youtube.com/watch?v=..."
					disabled={disabled}
					className={cn(
						"flex-1 rounded-md border bg-background px-3 py-2 text-sm",
						"placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
						!url ? "" : isValid ? "border-green-500" : "border-red-400",
					)}
				/>
				<Button
					size="sm"
					onClick={() => onSubmit(url)}
					disabled={!isValid || disabled}
				>
					Continue
				</Button>
			</div>
			{url && !isValid && (
				<p className="text-xs text-red-400">Enter a valid YouTube URL</p>
			)}
		</div>
	);
}
