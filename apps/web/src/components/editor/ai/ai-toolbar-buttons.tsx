"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiMicIcon,
	SparklesIcon,
	TextIcon,
	Image01Icon,
	Upload04Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

// ----- Types -----

interface AIToolbarButtonsProps {
	onTranscribe?: () => void;
	onGenerateImage?: () => void;
	onGenerateVoiceover?: () => void;
	onGenerateInfographic?: () => void;
	onRemoveBackground?: () => void;
	onAddSubtitles?: () => void;
	onCleanAudio?: () => void;
	onSetupClick?: () => void;
	isTranscribing?: boolean;
	isGenerating?: boolean;
	isConnected?: boolean;
	className?: string;
}

// ----- Component -----

export function AIToolbarButtons({
	onTranscribe,
	onGenerateImage,
	onGenerateVoiceover,
	onGenerateInfographic,
	onRemoveBackground,
	onAddSubtitles,
	onCleanAudio,
	onSetupClick,
	isTranscribing = false,
	isGenerating = false,
	isConnected = false,
	className,
}: AIToolbarButtonsProps) {
	const isDisabled = !isConnected;
	const disabledReason = isDisabled
		? "AI backend is not connected. Click to set up."
		: undefined;

	const handleDisabledClick = () => {
		if (isDisabled && onSetupClick) {
			onSetupClick();
		}
	};

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{/* Transcribe button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={isDisabled ? handleDisabledClick : onTranscribe}
						disabled={isTranscribing}
						aria-label="Transcribe audio"
						className={cn(isDisabled && "opacity-50")}
					>
						<HugeiconsIcon
							icon={AiMicIcon}
							className={cn(
								"size-4",
								isTranscribing && "animate-pulse",
							)}
						/>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					{disabledReason ?? "Transcribe"}
				</TooltipContent>
			</Tooltip>

			{/* AI Generate dropdown */}
			{isDisabled ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleDisabledClick}
							className="opacity-50"
							aria-label="AI Generate"
						>
							<HugeiconsIcon
								icon={SparklesIcon}
								className="size-4"
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent>{disabledReason}</TooltipContent>
				</Tooltip>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							disabled={isGenerating}
							aria-label="AI Generate"
							title="AI Generate"
						>
							<HugeiconsIcon
								icon={SparklesIcon}
								className={cn(
									"size-4",
									isGenerating && "animate-pulse",
								)}
							/>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-48">
						<DropdownMenuItem
							onClick={onGenerateImage}
							icon={<HugeiconsIcon icon={Image01Icon} />}
						>
							Image
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={onGenerateVoiceover}
							icon={<HugeiconsIcon icon={AiMicIcon} />}
						>
							Voiceover
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={onGenerateInfographic}
							icon={<HugeiconsIcon icon={TextIcon} />}
						>
							Infographic
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={onRemoveBackground}
							icon={<HugeiconsIcon icon={Upload04Icon} />}
						>
							Remove BG
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			{/* Subtitles button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={isDisabled ? handleDisabledClick : onAddSubtitles}
						aria-label="Add subtitles"
						className={cn(isDisabled && "opacity-50")}
					>
						<HugeiconsIcon icon={TextIcon} className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					{disabledReason ?? "Subtitles"}
				</TooltipContent>
			</Tooltip>

			{/* Clean Audio button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={isDisabled ? handleDisabledClick : onCleanAudio}
						aria-label="Clean audio"
						className={cn(isDisabled && "opacity-50")}
					>
						<HugeiconsIcon icon={SparklesIcon} className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					{disabledReason ?? "Clean audio"}
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
