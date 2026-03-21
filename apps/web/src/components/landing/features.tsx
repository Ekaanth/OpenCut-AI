"use client";

import { motion, useInView } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/utils/ui";

interface Feature {
	title: string;
	description: string;
	icon: ReactNode;
	color: string;
}

const features: Feature[] = [
	{
		title: "Edit by Text",
		description:
			"Transcribe your video, then edit it like a document. Delete a sentence and the video cuts itself. Drag to reorder scenes.",
		icon: <EditByTextIcon />,
		color: "text-blue-400",
	},
	{
		title: "AI Transcription",
		description:
			"Whisper-powered speech-to-text with word-level timestamps. Runs on your GPU or CPU with zero cloud dependency and zero cost.",
		icon: <TranscriptionIcon />,
		color: "text-violet-400",
	},
	{
		title: "Filler Removal",
		description:
			"Auto-detect \"um\", \"uh\", \"like\" and remove them in one click. Clean up your delivery without manual editing.",
		icon: <FillerIcon />,
		color: "text-orange-400",
	},
	{
		title: "Image Generation",
		description:
			"Generate images from prompts and place them on your timeline. Stable Diffusion running on your own hardware.",
		icon: <ImageGenIcon />,
		color: "text-pink-400",
	},
	{
		title: "Voice Cloning",
		description:
			"Clone any voice from a short sample. Generate voiceovers in male, female, or cloned voices across any language.",
		icon: <VoiceIcon />,
		color: "text-emerald-400",
	},
	{
		title: "Smart Subtitles",
		description:
			"One-click subtitles synced to your video. Position at the bottom, style them your way, toggle on and off.",
		icon: <SubtitleIcon />,
		color: "text-cyan-400",
	},
	{
		title: "AI Commands",
		description:
			"Control the editor in plain English. Say \"remove the intro\", \"add subtitles\", or \"speed up the middle\" and it just works.",
		icon: <CommandIcon />,
		color: "text-amber-400",
	},
	{
		title: "100% Local",
		description:
			"All models run on your machine. No cloud uploads, no API keys, no subscriptions. Your footage stays private.",
		icon: <PrivacyIcon />,
		color: "text-red-400",
	},
];

function FeatureCard({
	feature,
	index,
}: { feature: Feature; index: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-40px" });

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 24 }}
			animate={isInView ? { opacity: 1, y: 0 } : {}}
			transition={{
				duration: 0.6,
				delay: index * 0.07,
				ease: [0.22, 1, 0.36, 1],
			}}
			className="group relative overflow-hidden rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm transition-all duration-300 hover:border-border/60"
		>
			<div className="relative p-5">
				<div
					className={cn(
						"mb-4 flex size-10 items-center justify-center rounded-lg border border-border/30 bg-background/60",
						feature.color,
					)}
				>
					{feature.icon}
				</div>

				<h3 className="mb-2 text-sm font-semibold tracking-tight">
					{feature.title}
				</h3>

				<p className="text-[13px] leading-relaxed text-muted-foreground">
					{feature.description}
				</p>
			</div>
		</motion.div>
	);
}

export function Features() {
	const headingRef = useRef<HTMLDivElement>(null);
	const isHeadingInView = useInView(headingRef, { once: true, margin: "-80px" });

	return (
		<section className="relative overflow-hidden border-t px-4 py-24 md:py-32">
			{/* Shared atmosphere — same as hero */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,157,255,0.08),transparent)]" />
			<div
				className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
				style={{
					backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
					backgroundSize: "64px 64px",
				}}
			/>

			<div className="relative mx-auto max-w-5xl">
				<motion.div
					ref={headingRef}
					initial={{ opacity: 0, y: 20 }}
					animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
					transition={{
						duration: 0.7,
						ease: [0.22, 1, 0.36, 1],
					}}
					className="mb-14 text-center"
				>
					<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
						AI features added on top of OpenCut
					</h2>
					<p className="text-muted-foreground mx-auto mt-4 max-w-lg text-base">
						Transcription, voice cloning, filler removal, image generation
						— all running locally on your hardware.
					</p>
				</motion.div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature, index) => (
						<FeatureCard
							key={feature.title}
							feature={feature}
							index={index}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

// --- SVG Icons ---

function EditByTextIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
			<path d="m15 5 4 4" />
		</svg>
	);
}

function TranscriptionIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
			<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
			<line x1="12" x2="12" y1="19" y2="22" />
		</svg>
	);
}

function FillerIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M4 7h16" />
			<path d="M4 12h10" />
			<path d="M4 17h7" />
			<path d="m17 14 4 4" />
			<path d="m21 14-4 4" />
		</svg>
	);
}

function ImageGenIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
			<circle cx="9" cy="9" r="2" />
			<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
		</svg>
	);
}

function VoiceIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M2 10v3" />
			<path d="M6 6v11" />
			<path d="M10 3v18" />
			<path d="M14 8v7" />
			<path d="M18 5v13" />
			<path d="M22 10v3" />
		</svg>
	);
}

function SubtitleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="20" height="16" x="2" y="4" rx="2" />
			<path d="M7 15h4" />
			<path d="M15 15h2" />
			<path d="M7 11h2" />
			<path d="M13 11h4" />
		</svg>
	);
}

function CommandIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="m7 11 2-2-2-2" />
			<path d="M11 13h4" />
			<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
		</svg>
	);
}

function PrivacyIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
			<path d="m9 12 2 2 4-4" />
		</svg>
	);
}
