"use client";

import { motion, useInView } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ArrowRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import { SOCIAL_LINKS } from "@/constants/site-constants";

const INSTALL_COMMAND = `git clone https://github.com/Ekaanth/OpenCut-AI.git && cd OpenCut-AI && docker compose up -d`;

export function CTA() {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<section className="relative overflow-hidden border-t px-4 py-32 md:py-40">
			{/* Shared atmosphere — centered glow */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(0,157,255,0.08),transparent)]" />
			<div
				className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
				style={{
					backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
					backgroundSize: "64px 64px",
				}}
			/>

			<motion.div
				ref={ref}
				initial={{ opacity: 0 }}
				animate={isInView ? { opacity: 1 } : {}}
				transition={{ duration: 0.8 }}
				className="relative mx-auto max-w-3xl text-center"
			>
				{/* Large display text */}
				<motion.h2
					className="text-4xl font-bold tracking-tight md:text-6xl"
					initial={{ opacity: 0, y: 24 }}
					animate={isInView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
				>
					Your footage.
					<br />
					Your machine.
					<br />
					<span className="text-muted-foreground/30">Your rules.</span>
				</motion.h2>

				<motion.p
					className="mx-auto mt-8 max-w-md text-lg text-muted-foreground"
					initial={{ opacity: 0, y: 16 }}
					animate={isInView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
				>
					Fork it. Install it. Self-host it.
					No cloud, no subscriptions, no limits.
				</motion.p>

				<motion.div
					className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-4"
					initial={{ opacity: 0, y: 16 }}
					animate={isInView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
				>
					<Link href="/projects">
						<Button
							size="lg"
							className="group h-12 px-8 text-base font-medium shadow-lg shadow-primary/20"
						>
							Open the editor
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
							className="h-12 px-8 text-base font-medium"
						>
							Star on GitHub
						</Button>
					</Link>
				</motion.div>

				{/* Terminal-style install command */}
				<motion.div
					className="mx-auto mt-12 max-w-xl"
					initial={{ opacity: 0, y: 16 }}
					animate={isInView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
				>
					<TerminalBlock />
				</motion.div>
			</motion.div>
		</section>
	);
}

function TerminalBlock() {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(INSTALL_COMMAND);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, []);

	return (
		<div className="rounded-lg border border-border/40 bg-[#0d1117] overflow-hidden shadow-xl">
			<div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-white/5">
				<div className="flex items-center gap-1.5">
					<div className="size-3 rounded-full bg-[#ff5f57]" />
					<div className="size-3 rounded-full bg-[#febc2e]" />
					<div className="size-3 rounded-full bg-[#28c840]" />
				</div>
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5 transition-colors"
				>
					{copied ? (
						<>
							<Check className="size-3.5 text-[#28c840]" />
							<span className="text-[#28c840]">Copied</span>
						</>
					) : (
						<>
							<Copy className="size-3.5" />
							<span>Copy</span>
						</>
					)}
				</button>
			</div>
			<div className="px-4 py-4 overflow-x-auto">
				<div className="flex flex-col gap-1 text-[13px] font-mono">
					<div className="whitespace-nowrap">
						<span className="text-[#8b949e]">$ </span>
						<span className="text-[#7ee787]">git clone </span>
						<span className="text-[#79c0ff]">https://github.com/Ekaanth/OpenCut-AI.git</span>
					</div>
					<div className="whitespace-nowrap">
						<span className="text-[#8b949e]">$ </span>
						<span className="text-[#7ee787]">cd </span>
						<span className="text-[#e6edf3]">OpenCut-AI</span>
					</div>
					<div className="whitespace-nowrap">
						<span className="text-[#8b949e]">$ </span>
						<span className="text-[#7ee787]">docker compose </span>
						<span className="text-[#e6edf3]">up -d</span>
						<motion.span
							className="inline-block w-[7px] h-[18px] ml-0.5 bg-[#e6edf3] align-middle"
							animate={{ opacity: [1, 0] }}
							transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
