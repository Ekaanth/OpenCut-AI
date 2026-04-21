import type { Metadata } from "next";
import Link from "next/link";
import { BasePage } from "@/app/base-page";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "OpenCut AI vs CapCut — Privacy-First Open Source Alternative (No ByteDance)",
	description:
		"OpenCut AI is the free, open-source alternative to CapCut with no ByteDance data collection. Compare features: AI transcription, filler word removal, karaoke subtitles, voice cloning, B-roll generation, AI dubbing in 37 languages. Self-hosted and 100% local.",
	alternates: {
		canonical: `${SITE_URL}/compare/vs-capcut`,
	},
	openGraph: {
		title: "OpenCut AI vs CapCut — Privacy-First Alternative (No ByteDance)",
		description:
			"CapCut is owned by ByteDance (TikTok) and collects your data. OpenCut AI is open source, self-hosted, and runs 100% locally. No tracking. No data collection.",
		url: `${SITE_URL}/compare/vs-capcut`,
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenCut AI vs CapCut",
		description:
			"Free, open-source, no ByteDance. Privacy-first video editing that runs 100% locally.",
	},
};

const FEATURES = [
	{
		category: "Core Editing",
		rows: [
			{ feature: "Timeline-based editing", opencut: "Yes", capcut: "Yes" },
			{ feature: "Multi-track support", opencut: "Yes", capcut: "Yes" },
			{ feature: "Transitions library", opencut: "7 types (WebGL)", capcut: "100+ templates" },
			{ feature: "Speed ramping", opencut: "Variable curve editor", capcut: "Basic speed control" },
			{ feature: "Audio mixer with meters", opencut: "Yes", capcut: "Basic" },
			{ feature: "Proxy editing (4K+)", opencut: "Yes", capcut: "Automatic" },
			{ feature: "Text-based editing", opencut: "Yes", capcut: "No" },
		],
	},
	{
		category: "AI Features",
		rows: [
			{ feature: "AI transcription", opencut: "Whisper (local)", capcut: "Cloud-based" },
			{ feature: "Filler word removal", opencut: "One-click Smart Cut", capcut: "No" },
			{ feature: "Silence detection & removal", opencut: "Yes", capcut: "No" },
			{ feature: "AI voice cloning", opencut: "XTTS v2 (local)", capcut: "No" },
			{ feature: "AI dubbing / translation", opencut: "37 languages", capcut: "Limited auto-captions" },
			{ feature: "B-roll generation (AI)", opencut: "Image + Video", capcut: "No" },
			{ feature: "Auto-chapters", opencut: "Yes", capcut: "No" },
			{ feature: "Auto-reframe (9:16)", opencut: "Yes", capcut: "Yes" },
		],
	},
	{
		category: "Privacy & Data",
		rows: [
			{ feature: "Runs 100% locally", opencut: "Yes", capcut: "No" },
			{ feature: "Open source", opencut: "Yes (MIT)", capcut: "No" },
			{ feature: "Self-hosted option", opencut: "Yes", capcut: "No" },
			{ feature: "Data collection", opencut: "None", capcut: "Extensive (ByteDance)" },
			{ feature: "No internet required", opencut: "Yes", capcut: "No" },
			{ feature: "Telemetry", opencut: "None", capcut: "Extensive analytics" },
			{ feature: "No account required", opencut: "Yes", capcut: "No (requires login)" },
		],
	},
	{
		category: "Subtitles & Styling",
		rows: [
			{ feature: "Karaoke subtitles", opencut: "Yes", capcut: "No" },
			{ feature: "Word-pop subtitles", opencut: "Yes", capcut: "No" },
			{ feature: "Multi-speaker subtitles", opencut: "Yes", capcut: "No" },
			{ feature: "Indian language support", opencut: "22 languages (Sarvam AI)", capcut: "Auto-captions only" },
			{ feature: "Custom subtitle styles", opencut: "Yes", capcut: "Yes" },
		],
	},
	{
		category: "Pricing",
		rows: [
			{ feature: "Free tier", opencut: "Unlimited, full features", capcut: "Limited, watermarked" },
			{ feature: "Pro plan", opencut: "$0 forever", capcut: "$7.99/mo" },
			{ feature: "Annual cost", opencut: "$0", capcut: "$95.88" },
			{ feature: "Hidden costs", opencut: "None", capcut: "Credits for AI features" },
		],
	},
];

export default function VsCapCutPage() {
	return (
		<BasePage maxWidth="6xl">
			<div className="flex flex-col gap-12">
				<header className="text-center flex flex-col gap-6">
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
						OpenCut AI vs CapCut
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						CapCut is great for quick social edits — but it&apos;s owned by ByteDance (TikTok), 
						collects extensive data, and locks AI features behind credits. 
						OpenCut AI is <strong>open-source, self-hosted, and runs 100% locally</strong>.
					</p>
					<div className="flex gap-3 justify-center">
						<Link
							href="/editor"
							className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							Try OpenCut AI Free
						</Link>
						<Link
							href="https://github.com/Ekaanth/OpenCut-AI"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
						>
							View on GitHub
						</Link>
					</div>
				</header>

				<section className="space-y-8">
					{FEATURES.map((section) => (
						<div key={section.category}>
							<h2 className="text-xl font-semibold mb-3">{section.category}</h2>
							<div className="overflow-x-auto rounded-lg border">
								<table className="w-full text-sm">
									<thead>
										<tr className="bg-muted/50">
											<th className="text-left px-4 py-2.5 font-medium">Feature</th>
											<th className="text-center px-4 py-2.5 font-medium text-primary">
												OpenCut AI
											</th>
											<th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
												CapCut
											</th>
										</tr>
									</thead>
									<tbody>
										{section.rows.map((row, i) => (
											<tr
												key={row.feature}
												className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
											>
												<td className="px-4 py-2.5">{row.feature}</td>
												<td className="px-4 py-2.5 text-center">{row.opencut}</td>
												<td className="px-4 py-2.5 text-center text-muted-foreground">
													{row.capcut}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					))}
				</section>

				<section className="rounded-lg border bg-muted/30 p-6 md:p-8 space-y-4">
					<h2 className="text-2xl font-bold">Why choose OpenCut AI over CapCut?</h2>
					<div className="grid md:grid-cols-3 gap-6">
						<div>
							<h3 className="font-semibold mb-1">No ByteDance data collection</h3>
							<p className="text-sm text-muted-foreground">
								CapCut is made by ByteDance (TikTok). It collects usage data, device info, 
								and uploads content to their servers. OpenCut AI processes everything on your 
								machine — zero data collection, zero telemetry.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">Professional AI editing tools</h3>
							<p className="text-sm text-muted-foreground">
								CapCut is designed for quick social media edits. OpenCut AI adds professional 
								tools: text-based editing, Smart Cut (filler + silence removal), AI dubbing 
								in 37 languages, and AI B-roll generation.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">No credits, no watermarks</h3>
							<p className="text-sm text-muted-foreground">
								CapCut&apos;s AI features require credits and the free version adds watermarks. 
								OpenCut AI is fully free with zero limitations. All features, all the time.
							</p>
						</div>
					</div>
				</section>

				<section className="space-y-4 text-center">
					<h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
					<div className="max-w-2xl mx-auto space-y-4 text-left">
						<FAQ
							question="Is CapCut really collecting my data?"
							answer="Yes. CapCut's privacy policy states they collect device information, usage data, content you create, and share it with ByteDance group companies. They also upload your media to their servers for processing."
						/>
						<FAQ
							question="Does OpenCut AI have CapCut-style templates and effects?"
							answer="OpenCut AI focuses on professional editing tools rather than social media templates. You get full control over transitions, subtitles, and effects rather than pre-made templates."
						/>
						<FAQ
							question="Can I use OpenCut AI for TikTok/Reels/Shorts?"
							answer="Absolutely. OpenCut AI has auto-reframe for 9:16 vertical format, karaoke subtitles, and all the tools you need for social media content — without the data collection."
						/>
						<FAQ
							question="What about Indian language content?"
							answer="OpenCut AI supports 22 Indian languages via Sarvam AI for transcription, translation, and AI dubbing. CapCut offers basic auto-captions but no Indian language TTS or dubbing."
						/>
					</div>
				</section>

				<div className="text-center py-8">
					<h2 className="text-2xl font-bold mb-3">
						Stop giving your content to ByteDance
					</h2>
					<p className="text-muted-foreground mb-6">
						Edit videos locally with AI. No account. No tracking. No data leaves your machine.
					</p>
					<Link
						href="/editor"
						className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Open Editor — It&apos;s Free
					</Link>
				</div>
			</div>
		</BasePage>
	);
}

function FAQ({ question, answer }: { question: string; answer: string }) {
	return (
		<details className="rounded-lg border p-4 group">
			<summary className="font-medium cursor-pointer list-none flex items-center justify-between">
				{question}
				<span className="text-muted-foreground group-open:rotate-180 transition-transform">
					<svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</span>
			</summary>
			<p className="text-sm text-muted-foreground mt-2">{answer}</p>
		</details>
	);
}
