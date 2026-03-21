"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "@/utils/ui";

interface PricingTier {
	name: string;
	price: string;
	period: string;
	description: string;
	specs: string;
	features: string[];
	highlight?: boolean;
	note?: string;
}

const tiers: PricingTier[] = [
	{
		name: "Local Machine",
		price: "$0",
		period: "forever",
		description: "Run on your own computer",
		specs: "Any laptop with 8+ GB RAM",
		features: [
			"Full video editor",
			"AI transcription (CPU)",
			"Voice cloning & TTS",
			"Text-based editing",
			"Filler word removal",
			"All filters & effects",
		],
		note: "No GPU = no image generation",
	},
	{
		name: "Starter VPS",
		price: "$20",
		period: "/month",
		description: "Light editing & transcription",
		specs: "4 vCPU, 8 GB RAM, CPU-only",
		features: [
			"Everything in Local",
			"Remote access from any device",
			"Always-on availability",
			"Shareable with team",
			"Transcription + TTS",
			"LLM commands",
		],
		note: "Hetzner, DigitalOcean, Vultr",
	},
	{
		name: "Standard VPS",
		price: "$50",
		period: "/month",
		description: "Full workflow, no GPU",
		specs: "4 vCPU, 16 GB RAM",
		features: [
			"Everything in Starter",
			"Faster transcription",
			"Larger LLM models (7B+)",
			"Voice cloning at quality",
			"Multiple concurrent users",
			"Full TTS generation",
		],
		highlight: true,
		note: "Best value for most teams",
	},
	{
		name: "GPU Server",
		price: "$150",
		period: "/month",
		description: "All AI features at speed",
		specs: "8 vCPU, 32 GB RAM, NVIDIA T4",
		features: [
			"Everything in Standard",
			"10x faster transcription",
			"AI image generation",
			"Real-time voice cloning",
			"Large LLM models",
			"Production-ready speed",
		],
		note: "AWS g4dn, RunPod, Lambda",
	},
];

const comparisons = [
	{ feature: "Monthly cost", opencut: "$0–150", descript: "$24–33/user", kapwing: "$24–79/user", runway: "$12–76/user" },
	{ feature: "Per-seat pricing", opencut: "No", descript: "Yes", kapwing: "Yes", runway: "Yes" },
	{ feature: "Usage limits", opencut: "None", descript: "Minutes", kapwing: "Credits", runway: "Credits" },
	{ feature: "Data privacy", opencut: "Your server", descript: "Cloud", kapwing: "Cloud", runway: "Cloud" },
	{ feature: "AI models", opencut: "Open-source", descript: "Proprietary", kapwing: "Proprietary", runway: "Proprietary" },
	{ feature: "Self-hostable", opencut: "Yes", descript: "No", kapwing: "No", runway: "No" },
];

export function Pricing() {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-60px" });

	return (
		<section className="relative overflow-hidden border-t px-4 py-24 md:py-32">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(0,157,255,0.04),transparent)]" />

			<motion.div
				ref={ref}
				initial={{ opacity: 0, y: 20 }}
				animate={isInView ? { opacity: 1, y: 0 } : {}}
				transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
				className="relative mx-auto max-w-5xl"
			>
				<div className="text-center mb-16">
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={isInView ? { opacity: 1, scale: 1 } : {}}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-500"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
						</svg>
						No per-seat pricing
					</motion.div>
					<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
						Self-host for the
						<br />
						<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
							cost of a VPS
						</span>
					</h2>
					<p className="text-muted-foreground mt-5 text-base md:text-lg max-w-lg mx-auto">
						No usage credits. No cloud lock-in. Pay only for the server and use it as much as you want, with as many users as you need.
					</p>
				</div>

				{/* Pricing tiers */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
					{tiers.map((tier, index) => (
						<motion.div
							key={tier.name}
							initial={{ opacity: 0, y: 20 }}
							animate={isInView ? { opacity: 1, y: 0 } : {}}
							transition={{ duration: 0.5, delay: index * 0.1 }}
							className={cn(
								"rounded-xl border p-5 flex flex-col",
								tier.highlight
									? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
									: "border-border",
							)}
						>
							{tier.highlight && (
								<span className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">
									Most Popular
								</span>
							)}
							<h3 className="text-lg font-bold">{tier.name}</h3>
							<div className="flex items-baseline gap-1 mt-2">
								<span className="text-3xl font-bold tracking-tight">{tier.price}</span>
								<span className="text-sm text-muted-foreground">{tier.period}</span>
							</div>
							<p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
							<p className="text-xs text-muted-foreground/70 mt-1 font-mono">{tier.specs}</p>

							<ul className="mt-5 flex-1 flex flex-col gap-2">
								{tier.features.map((feature) => (
									<li key={feature} className="flex items-start gap-2 text-sm">
										<span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
										{feature}
									</li>
								))}
							</ul>

							{tier.note && (
								<p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t">
									{tier.note}
								</p>
							)}
						</motion.div>
					))}
				</div>
			</motion.div>
		</section>
	);
}
