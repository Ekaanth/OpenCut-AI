"use client";

import { motion, useInView } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/utils/ui";

interface Feature {
	title: string;
	description: string;
	icon: ReactNode;
	color: string;
	gradient: string;
	tag?: string;
}

const coreFeatures: Feature[] = [
	{
		title: "Edit by Text",
		description:
			"Transcribe your video, then edit it like a document. Delete a sentence and the video cuts itself. Drag to reorder scenes.",
		icon: <EditByTextIcon />,
		color: "text-blue-400",
		gradient: "from-blue-500/20 to-blue-600/5",
	},
	{
		title: "Multi-Speaker Detection",
		description:
			"Auto-detect who's talking with pyannote AI. Each speaker gets a label you can rename. Video auto-cuts at speaker boundaries.",
		icon: <SpeakerIcon />,
		color: "text-violet-400",
		gradient: "from-violet-500/20 to-violet-600/5",
		tag: "New",
	},
	{
		title: "Voice Cloning",
		description:
			"Clone any voice from a 6-second sample. Generate voiceovers in cloned voices across any language. XTTS v2 powered.",
		icon: <VoiceIcon />,
		color: "text-emerald-400",
		gradient: "from-emerald-500/20 to-emerald-600/5",
	},
	{
		title: "100% Local",
		description:
			"All models run on your machine. No cloud uploads, no API keys, no subscriptions. Your footage stays private.",
		icon: <PrivacyIcon />,
		color: "text-red-400",
		gradient: "from-red-500/20 to-red-600/5",
	},
];

const podcastFeatures: Feature[] = [
	{
		title: "Podcast Clip Generator",
		description:
			"AI finds the most viral-worthy 30-60 second moments from long podcasts. Scored by engagement potential, emotional peaks, and shareability.",
		icon: <ClipFinderIcon />,
		color: "text-rose-400",
		gradient: "from-rose-500/20 to-rose-600/5",
		tag: "New",
	},
	{
		title: "Word-Pop Karaoke Subs",
		description:
			"Hormozi-style subtitles where each word pops up when spoken and scales larger. Keyword highlighting with accent colors. 4 preset styles.",
		icon: <KaraokeIcon />,
		color: "text-amber-400",
		gradient: "from-amber-500/20 to-amber-600/5",
		tag: "New",
	},
	{
		title: "Auto-Reframe 9:16",
		description:
			"Face-tracking crop that converts 16:9 to 9:16 for TikTok, Reels, and Shorts. Smooth pan transitions between speakers using MediaPipe.",
		icon: <ReframeIcon />,
		color: "text-cyan-400",
		gradient: "from-cyan-500/20 to-cyan-600/5",
		tag: "New",
	},
	{
		title: "Brand Kit",
		description:
			"Define your brand once — colors, fonts, logo, social handles, CTA. One-click intro/outro cards, lower thirds, and persistent watermarks.",
		icon: <BrandIcon />,
		color: "text-fuchsia-400",
		gradient: "from-fuchsia-500/20 to-fuchsia-600/5",
		tag: "New",
	},
];

const extraFeatures: Feature[] = [
	{
		title: "AI Question Cards",
		description:
			"AI generates topic question slides from your transcript. Overlaid on video with transparent or themed backgrounds. Subtitles auto-hide during cards.",
		icon: <CardIcon />,
		color: "text-orange-400",
		gradient: "from-orange-500/20 to-orange-600/5",
		tag: "New",
	},
	{
		title: "Emotion Detection",
		description:
			"SpeechBrain AI detects emotional peaks in your audio — excitement, calm, neutral. Used to boost clip scores and find the most impactful moments.",
		icon: <EmotionIcon />,
		color: "text-pink-400",
		gradient: "from-pink-500/20 to-pink-600/5",
		tag: "New",
	},
	{
		title: "Speed Control",
		description:
			"0.1x slow-mo to 4x fast-forward on any clip. 8 preset speeds plus a continuous slider. Audio pitch adjusts automatically.",
		icon: <SpeedIcon />,
		color: "text-sky-400",
		gradient: "from-sky-500/20 to-sky-600/5",
		tag: "New",
	},
	{
		title: "AI Transcription",
		description:
			"Whisper-powered speech-to-text with word-level timestamps. Runs on your GPU or CPU. Auto-detects language across 12+ languages.",
		icon: <TranscriptionIcon />,
		color: "text-teal-400",
		gradient: "from-teal-500/20 to-teal-600/5",
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
			className="group relative overflow-hidden rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm transition-all duration-300 hover:border-border/60 hover:shadow-lg hover:shadow-black/5"
		>
			{/* Gradient glow on hover */}
			<div
				className={cn(
					"absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100",
					feature.gradient,
				)}
			/>

			<div className="relative p-5">
				<div className="mb-4 flex items-center justify-between">
					<div
						className={cn(
							"flex size-10 items-center justify-center rounded-lg border border-border/30 bg-background/60",
							feature.color,
						)}
					>
						{feature.icon}
					</div>
					{feature.tag && (
						<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
							{feature.tag}
						</span>
					)}
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

function SectionLabel({
	children,
	color,
}: { children: React.ReactNode; color: string }) {
	return (
		<div className="mb-8 flex items-center gap-3">
			<div className={cn("h-px flex-1 bg-gradient-to-r from-transparent", color)} />
			<span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
				{children}
			</span>
			<div className={cn("h-px flex-1 bg-gradient-to-l from-transparent", color)} />
		</div>
	);
}

export function Features() {
	const headingRef = useRef<HTMLDivElement>(null);
	const isHeadingInView = useInView(headingRef, { once: true, margin: "-80px" });

	return (
		<section className="relative overflow-hidden border-t px-4 py-24 md:py-32">
			{/* Shared atmosphere */}
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
					className="mb-16 text-center"
				>
					<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
						AI-powered editing for{" "}
						<span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-300 bg-clip-text text-transparent">
							creators who ship
						</span>
					</h2>
					<p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base">
						Transcription, multi-speaker detection, viral clip finding, voice cloning,
						word-pop subtitles, auto-reframe, brand kits, and more
						— all running locally on your hardware.
					</p>
				</motion.div>

				{/* Core AI */}
				<SectionLabel color="to-blue-500/30">Core AI Engine</SectionLabel>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{coreFeatures.map((feature, index) => (
						<FeatureCard key={feature.title} feature={feature} index={index} />
					))}
				</div>

				{/* Podcast Studio */}
				<div className="mt-16">
					<SectionLabel color="to-rose-500/30">Podcast Clip Studio</SectionLabel>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{podcastFeatures.map((feature, index) => (
							<FeatureCard key={feature.title} feature={feature} index={index} />
						))}
					</div>
				</div>

				{/* More Features */}
				<div className="mt-16">
					<SectionLabel color="to-amber-500/30">And Even More</SectionLabel>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{extraFeatures.map((feature, index) => (
							<FeatureCard key={feature.title} feature={feature} index={index} />
						))}
					</div>
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

function SpeakerIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function VoiceIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" />
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

function ClipFinderIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
			<path d="m9 9 2 2 4-4" />
		</svg>
	);
}

function KaraokeIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="20" height="16" x="2" y="4" rx="2" />
			<path d="M7 15h2" />
			<path d="M11 15h2" style={{ strokeWidth: 2.8 }} />
			<path d="M15 15h2" />
			<path d="M7 11h10" />
		</svg>
	);
}

function ReframeIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="8" height="14" x="8" y="5" rx="1.5" />
			<path d="M4 9h4" /><path d="M16 9h4" />
			<path d="M4 15h4" /><path d="M16 15h4" />
			<circle cx="12" cy="10" r="2" />
		</svg>
	);
}

function BrandIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2 2 7l10 5 10-5-10-5Z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
	);
}

function CardIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="18" height="14" x="3" y="5" rx="2" />
			<path d="M12 12h.01" />
			<path d="M8 9h8" />
			<path d="M9 15h6" />
		</svg>
	);
}

function EmotionIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<path d="M8 14s1.5 2 4 2 4-2 4-2" />
			<line x1="9" x2="9.01" y1="9" y2="9" />
			<line x1="15" x2="15.01" y1="9" y2="9" />
		</svg>
	);
}

function SpeedIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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
