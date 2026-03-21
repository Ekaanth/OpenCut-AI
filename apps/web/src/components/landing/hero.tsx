"use client";

import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { SOCIAL_LINKS } from "@/constants/site-constants";
import { useRef } from "react";

const STATS = [
	{ value: "6", label: "AI Services" },
	{ value: "12+", label: "Languages" },
	{ value: "$0", label: "API Cost" },
	{ value: "100%", label: "Local" },
];

export function Hero() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start start", "end start"],
	});

	const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
	const textY = useTransform(scrollYProgress, [0, 0.5], [0, -60]);

	return (
		<div
			ref={containerRef}
			className="relative flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-center overflow-hidden px-4"
		>
			{/* Cinematic background layers */}
			<motion.div
				className="absolute inset-0 -z-10"
				style={{ y: bgY }}
			>
				{/* Dark radial gradient */}
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,157,255,0.12),transparent)]" />
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,rgba(120,80,255,0.06),transparent)]" />

				{/* Grid pattern */}
				<div
					className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
					style={{
						backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
						backgroundSize: "64px 64px",
					}}
				/>

				{/* Noise grain */}
				<div
					className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
					}}
				/>
			</motion.div>

			{/* Floating orbs */}
			<motion.div
				className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary/5 blur-[120px]"
				animate={{
					x: [0, 30, -20, 0],
					y: [0, -20, 15, 0],
				}}
				transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
			/>
			<motion.div
				className="absolute bottom-1/4 right-1/4 size-72 rounded-full bg-violet-500/5 blur-[100px]"
				animate={{
					x: [0, -25, 15, 0],
					y: [0, 15, -25, 0],
				}}
				transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
			/>

			{/* Main content */}
			<motion.div
				className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center"
				style={{ opacity: textOpacity, y: textY }}
			>
				{/* Eyebrow badge */}
				<motion.div
					initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
				>
					<span className="inline-flex items-center gap-2.5 rounded-full border border-border/60 bg-background/60 backdrop-blur-md px-4 py-2 text-sm">
						<span className="relative flex size-2">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
							<span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
						</span>
						<span className="text-muted-foreground">
							Open source
							<span className="mx-1.5 text-border">|</span>
							Runs locally
							<span className="mx-1.5 text-border">|</span>
							No cloud
						</span>
					</span>
				</motion.div>

				{/* Main heading */}
				<motion.h1
					className="mt-8 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
				>
					<span className="block">Video editing,</span>
					<span className="relative mt-1 inline-block">
						<span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-300 bg-clip-text text-transparent">
							reimagined
						</span>
						{/* Animated underline */}
						<motion.span
							className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-cyan-400"
							initial={{ width: "0%" }}
							animate={{ width: "100%" }}
							transition={{ duration: 1, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
						/>
					</span>
					<span className="block text-muted-foreground/40 mt-1">by AI.</span>
				</motion.h1>

				{/* Subtitle */}
				<motion.p
					className="mx-auto mt-8 max-w-xl text-lg text-muted-foreground md:text-xl"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
				>
					Transcribe, edit by text, clone voices, and generate visuals.
					Everything runs on your machine. No subscriptions. No cloud.
				</motion.p>

				{/* CTA buttons */}
				<motion.div
					className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-4"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
				>
					<Link href="/projects">
						<Button
							size="lg"
							className="group h-12 px-8 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
						>
							Start editing
							<ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
						</Button>
					</Link>
					<Link
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Button
							variant="outline"
							size="lg"
							className="h-12 px-8 text-base font-medium backdrop-blur-sm"
						>
							<svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							Star on GitHub
						</Button>
					</Link>
				</motion.div>

				{/* Stats row */}
				<motion.div
					className="mt-16 grid w-full max-w-lg grid-cols-4 gap-1"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
				>
					{STATS.map((stat, i) => (
						<motion.div
							key={stat.label}
							className="flex flex-col items-center gap-1 rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm px-3 py-3"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.5, delay: 0.8 + i * 0.08 }}
						>
							<span className="text-xl font-bold tracking-tight sm:text-2xl">
								{stat.value}
							</span>
							<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
								{stat.label}
							</span>
						</motion.div>
					))}
				</motion.div>
			</motion.div>

			{/* Scroll indicator */}
			<motion.div
				className="absolute bottom-8 flex flex-col items-center gap-2"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.2 }}
			>
				<span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
					Scroll to explore
				</span>
				<motion.div
					className="size-5 rounded-full border border-muted-foreground/20 flex items-center justify-center"
					animate={{ y: [0, 6, 0] }}
					transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
				>
					<div className="size-1 rounded-full bg-muted-foreground/40" />
				</motion.div>
			</motion.div>
		</div>
	);
}
