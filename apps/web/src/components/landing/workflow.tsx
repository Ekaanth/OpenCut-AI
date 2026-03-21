"use client";

import { motion, useInView, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { cn } from "@/utils/ui";

interface Step {
	number: string;
	title: string;
	description: string;
	icon: React.ReactNode;
	color: string;
	tagColor: string;
	tags: string[];
}

const steps: Step[] = [
	{
		number: "01",
		title: "Drop your footage",
		description:
			"Drag any video or audio file into the editor. Pick a frame format like 16:9 for YouTube, 9:16 for Reels, or 1:1 for Instagram and start editing instantly.",
		icon: <UploadIcon />,
		color: "text-blue-400",
		tagColor: "border-blue-500/30 text-blue-400",
		tags: ["Multi-format", "Local-first", "No upload"],
	},
	{
		number: "02",
		title: "Transcribe with Whisper",
		description:
			"One click to transcribe. Whisper runs locally and generates word-level timestamps. Every word maps precisely to the timeline so editing the text edits the video.",
		icon: <MicIcon />,
		color: "text-violet-400",
		tagColor: "border-violet-500/30 text-violet-400",
		tags: ["Word-level timing", "Auto language", "Local AI"],
	},
	{
		number: "03",
		title: "Edit like a document",
		description:
			"Read the transcript like a doc. Delete a sentence to cut the video. Rearrange paragraphs to reorder scenes. Remove all filler words in one click. Add subtitles with karaoke highlighting.",
		icon: <TextEditIcon />,
		color: "text-emerald-400",
		tagColor: "border-emerald-500/30 text-emerald-400",
		tags: ["Text = video", "Filler removal", "Karaoke subs"],
	},
	{
		number: "04",
		title: "Translate to any language",
		description:
			"Translate your transcript and subtitles into multiple languages using the local LLM. Each translation gets its own tab and subtitle track while the original stays intact for reference.",
		icon: <TranslateIcon />,
		color: "text-cyan-400",
		tagColor: "border-cyan-500/30 text-cyan-400",
		tags: ["9 languages", "Multi-track subs", "LLM-powered"],
	},
	{
		number: "05",
		title: "Generate, clone, enhance",
		description:
			"Generate images from text prompts. Clone any voice from a 6-second sample. Add AI voiceovers, denoise audio, separate audio tracks, freeze frames, and control volume per element.",
		icon: <WandIcon />,
		color: "text-pink-400",
		tagColor: "border-pink-500/30 text-pink-400",
		tags: ["Voice cloning", "Image gen", "Audio tools"],
	},
	{
		number: "06",
		title: "Export the final cut",
		description:
			"Export with everything baked in. Subtitles, voiceovers, and AI visuals all composited into the final file. Background tasks keep running while you work on other things.",
		icon: <FilmIcon />,
		color: "text-amber-400",
		tagColor: "border-amber-500/30 text-amber-400",
		tags: ["Multi-format", "Background export", "No watermark"],
	},
];

export function Workflow() {
	const headingRef = useRef<HTMLDivElement>(null);
	const isHeadingInView = useInView(headingRef, { once: true, margin: "-80px" });
	const sectionRef = useRef<HTMLDivElement>(null);

	// Scroll progress for the vertical line fill
	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ["start end", "end start"],
	});
	const lineHeight = useTransform(scrollYProgress, [0.1, 0.85], ["0%", "100%"]);

	return (
		<section
			ref={sectionRef}
			className="relative overflow-hidden border-t px-4 py-24 md:py-32"
		>
			{/* Shared atmosphere */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(120,80,255,0.06),transparent)]" />
			<div
				className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
				style={{
					backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
					backgroundSize: "64px 64px",
				}}
			/>

			<div className="relative mx-auto max-w-3xl">
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
						From raw footage to final cut
					</h2>
					<p className="text-muted-foreground mx-auto mt-4 max-w-lg text-base">
						A fork of OpenCut with AI added on top. Import, transcribe,
						translate, enhance, and export. All running locally on your machine.
					</p>
				</motion.div>

				{/* Timeline */}
				<div className="relative">
					{/* Dashed background line */}
					<div className="absolute top-0 bottom-0 left-[27px] w-px border-l border-dashed border-border/30 md:left-[31px]" />

					{/* Solid line that fills on scroll */}
					<motion.div
						className="absolute top-0 left-[27px] w-px bg-gradient-to-b from-blue-500 via-violet-500 to-amber-500 md:left-[31px]"
						style={{ height: lineHeight }}
					/>

					<div className="flex flex-col gap-10">
						{steps.map((step, index) => (
							<WorkflowStep
								key={step.number}
								step={step}
								index={index}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function WorkflowStep({ step, index }: { step: Step; index: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-60px" });

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 32 }}
			animate={isInView ? { opacity: 1, y: 0 } : {}}
			transition={{
				duration: 0.6,
				delay: 0.1,
				ease: [0.22, 1, 0.36, 1],
			}}
			className="relative flex items-start gap-4 md:gap-5"
		>
			{/* Icon */}
			<motion.div
				className={cn(
					"relative z-10 flex size-14 items-center justify-center rounded-xl border border-border/30 bg-background/80 backdrop-blur-sm shrink-0 md:size-16",
					step.color,
				)}
				initial={{ scale: 0.8, opacity: 0 }}
				animate={isInView ? { scale: 1, opacity: 1 } : {}}
				transition={{
					duration: 0.4,
					delay: 0.2,
					ease: [0.22, 1, 0.36, 1],
				}}
			>
				{step.icon}
			</motion.div>

			{/* Content */}
			<div className="pt-1 flex-1 min-w-0">
				<span className={cn(
					"text-[10px] font-mono font-bold tracking-widest uppercase",
					step.color,
					"opacity-60",
				)}>
					Step {step.number}
				</span>
				<h3 className="text-base font-semibold tracking-tight mt-0.5 md:text-lg">
					{step.title}
				</h3>
				<p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
					{step.description}
				</p>

				{/* Colored tags */}
				<motion.div
					className="mt-3 flex flex-wrap gap-1.5"
					initial={{ opacity: 0 }}
					animate={isInView ? { opacity: 1 } : {}}
					transition={{ duration: 0.4, delay: 0.35 }}
				>
					{step.tags.map((tag) => (
						<span
							key={tag}
							className={cn(
								"inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
								step.tagColor,
							)}
						>
							{tag}
						</span>
					))}
				</motion.div>
			</div>
		</motion.div>
	);
}

// --- SVG Icons ---

function UploadIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" x2="12" y1="3" y2="15" />
		</svg>
	);
}

function MicIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
			<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
			<line x1="12" x2="12" y1="19" y2="22" />
		</svg>
	);
}

function TextEditIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 20h9" />
			<path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855Z" />
		</svg>
	);
}

function TranslateIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 8l6 6" />
			<path d="M4 14l6-6 2-3" />
			<path d="M2 5h12" />
			<path d="M7 2h1" />
			<path d="M22 22l-5-10-5 10" />
			<path d="M14 18h6" />
		</svg>
	);
}

function WandIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
			<path d="m14 7 3 3" />
			<path d="M5 6v4" />
			<path d="M19 14v4" />
			<path d="M10 2v2" />
			<path d="M7 8H3" />
			<path d="M21 16h-4" />
			<path d="M11 3H9" />
		</svg>
	);
}

function FilmIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M7 3v18" />
			<path d="M3 7.5h4" />
			<path d="M3 12h18" />
			<path d="M3 16.5h4" />
			<path d="M17 3v18" />
			<path d="M17 7.5h4" />
			<path d="M17 16.5h4" />
		</svg>
	);
}
