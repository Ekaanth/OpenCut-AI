"use client";

import { useState } from "react";
import { SOCIAL_LINKS } from "@/constants/site-constants";
import { useLocalStorage } from "@/hooks/storage/use-local-storage";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogTitle } from "../ui/dialog";
import { useAIStatus } from "@/hooks/use-ai-status";
import { useAIStore } from "@/stores/ai-store";
import { cn } from "@/utils/ui";

export function Onboarding() {
	const [step, setStep] = useState(0);
	const [hasSeenOnboarding, setHasSeenOnboarding] = useLocalStorage({
		key: "hasSeenOnboarding-v2",
		defaultValue: false,
	});
	const { isConnected } = useAIStatus();
	const toggleSetupGuide = useAIStore((s) => s.toggleSetupGuide);

	const isOpen = !hasSeenOnboarding;

	const handleNext = () => setStep(step + 1);
	const handleClose = () => setHasSeenOnboarding({ value: true });

	const handleOpenSetup = () => {
		handleClose();
		toggleSetupGuide();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogTitle>
					<span className="sr-only">Welcome to OpenCut AI</span>
				</DialogTitle>
				<DialogBody>
					{step === 0 && (
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<h2 className="text-lg font-bold">Welcome to OpenCut AI</h2>
								<p className="text-sm text-muted-foreground leading-relaxed">
									This is a fork of OpenCut with AI added on top. Edit video
									by text, generate visuals, clone voices, and command the
									timeline — install locally and everything runs on your machine.
								</p>
							</div>

							<div className="flex flex-col gap-3">
								<StepItem
									number={1}
									title="Import your video"
									description="Drag a video file into the editor or use the media panel"
								/>
								<StepItem
									number={2}
									title="Transcribe it"
									description="Click the microphone button to convert speech to text"
								/>
								<StepItem
									number={3}
									title="Edit the text"
									description="Delete words, remove filler, reorder sections — the video follows"
								/>
							</div>

							<Button onClick={handleNext} className="w-full">
								Next
							</Button>
						</div>
					)}

					{step === 1 && (
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<h2 className="text-lg font-bold">Local AI backend powers everything</h2>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Transcription, voice cloning, image generation, and natural
									language commands all run on a local AI backend. Your footage
									never leaves your machine.
								</p>
							</div>

							{/* Connection status */}
							<div
								className={cn(
									"flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
									isConnected
										? "bg-green-500/10 text-green-400"
										: "bg-yellow-500/10 text-yellow-500",
								)}
							>
								<span
									className={cn(
										"size-2 rounded-full shrink-0",
										isConnected ? "bg-green-500" : "bg-yellow-500",
									)}
								/>
								{isConnected ? (
									<span>AI backend is connected — you're all set</span>
								) : (
									<span>AI backend is not running — set it up to unlock AI features</span>
								)}
							</div>

							<div className="flex gap-2">
								{!isConnected && (
									<Button
										variant="outline"
										onClick={handleOpenSetup}
										className="flex-1"
									>
										Set up AI
									</Button>
								)}
								<Button onClick={handleNext} className="flex-1">
									{isConnected ? "Get started" : "Skip for now"}
								</Button>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-2">
								<h2 className="text-lg font-bold">You're ready to go</h2>
								<p className="text-sm text-muted-foreground leading-relaxed">
									This is an early beta. Open an issue on{" "}
									<a
										href={SOCIAL_LINKS.github}
										target="_blank"
										rel="noopener noreferrer"
										className="text-foreground underline hover:text-foreground/80"
									>
										GitHub
									</a>{" "}
									to share feedback and help shape the editor.
								</p>
							</div>

							<Button onClick={handleClose} className="w-full">
								Start editing
							</Button>
						</div>
					)}
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

function StepItem({
	number,
	title,
	description,
}: {
	number: number;
	title: string;
	description: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
				{number}
			</div>
			<div>
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}
