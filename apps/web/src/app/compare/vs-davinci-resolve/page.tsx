import type { Metadata } from "next";
import Link from "next/link";
import { BasePage } from "@/app/base-page";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "OpenCut AI vs DaVinci Resolve — Free Open Source Video Editor with AI (No $295 Lock-in)",
	description:
		"OpenCut AI is the browser-based, open-source alternative to DaVinci Resolve. Compare: AI transcription, text-based editing, filler word removal, AI dubbing in 37 languages, B-roll generation, karaoke subtitles. Free, self-hosted, no hardware requirements.",
	alternates: {
		canonical: `${SITE_URL}/compare/vs-davinci-resolve`,
	},
	openGraph: {
		title: "OpenCut AI vs DaVinci Resolve — Free Browser-Based AI Video Editor",
		description:
			"DaVinci Resolve costs $295 and needs a powerful GPU. OpenCut AI runs in your browser, is free, open source, and has AI transcription, dubbing, and B-roll generation.",
		url: `${SITE_URL}/compare/vs-davinci-resolve`,
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenCut AI vs DaVinci Resolve",
		description:
			"Free, browser-based, AI-powered video editor. No $295 price tag. No GPU requirements.",
	},
};

const FEATURES = [
	{
		category: "Core Editing",
		rows: [
			{ feature: "Timeline-based editing", opencut: "Yes", resolve: "Yes" },
			{ feature: "Multi-track support", opencut: "Yes", resolve: "Yes (unlimited)" },
			{ feature: "Color grading", opencut: "Basic", resolve: "Industry-leading" },
			{ feature: "Transitions library", opencut: "7 types", resolve: "Extensive" },
			{ feature: "Speed ramping", opencut: "Variable curve editor", resolve: "Yes (Speed Editor)" },
			{ feature: "Audio mixer with meters", opencut: "Yes", resolve: "Fairlight (professional)" },
			{ feature: "Proxy editing (4K+)", opencut: "Yes", resolve: "Yes" },
			{ feature: "Text-based editing", opencut: "Yes", resolve: "No" },
		],
	},
	{
		category: "AI Features",
		rows: [
			{ feature: "AI transcription", opencut: "Whisper (local)", resolve: "No" },
			{ feature: "Filler word removal", opencut: "One-click Smart Cut", resolve: "No" },
			{ feature: "Silence detection", opencut: "Yes", resolve: "No" },
			{ feature: "AI voice cloning", opencut: "XTTS v2 (local)", resolve: "No" },
			{ feature: "AI dubbing / translation", opencut: "37 languages", resolve: "No" },
			{ feature: "B-roll generation (AI)", opencut: "Image + Video", resolve: "No" },
			{ feature: "Auto-chapters", opencut: "Yes", resolve: "No" },
			{ feature: "Auto-reframe (9:16)", opencut: "Yes", resolve: "No (manual)" },
			{ feature: "AI text-to-speech", opencut: "Yes (local + cloud)", resolve: "No" },
		],
	},
	{
		category: "Subtitles & Accessibility",
		rows: [
			{ feature: "Karaoke subtitles", opencut: "Yes", resolve: "No" },
			{ feature: "Word-pop subtitles", opencut: "Yes", resolve: "No" },
			{ feature: "Multi-speaker subtitles", opencut: "Yes", resolve: "No" },
			{ feature: "Indian language support", opencut: "22 languages (Sarvam AI)", resolve: "No" },
			{ feature: "Custom subtitle styles", opencut: "Yes", resolve: "Fusion-based (complex)" },
		],
	},
	{
		category: "Deployment & Requirements",
		rows: [
			{ feature: "Runs in browser", opencut: "Yes", resolve: "No (desktop app)" },
			{ feature: "No installation needed", opencut: "Yes", resolve: "No" },
			{ feature: "Open source", opencut: "Yes (MIT)", resolve: "No (free version + $295 Studio)" },
			{ feature: "Self-hosted option", opencut: "Yes", resolve: "No" },
			{ feature: "GPU required", opencut: "No", resolve: "Strongly recommended" },
			{ feature: "Cross-platform", opencut: "Any browser", resolve: "Win/Mac/Linux app" },
			{ feature: "Learning curve", opencut: "Easy", resolve: "Steep" },
		],
	},
	{
		category: "Pricing",
		rows: [
			{ feature: "Free tier", opencut: "Full features, unlimited", resolve: "Full features, limited codecs" },
			{ feature: "Paid version", opencut: "$0 forever", resolve: "$295 one-time (Studio)" },
			{ feature: "Total cost of ownership", opencut: "$0", resolve: "$0–295 + hardware upgrades" },
		],
	},
];

export default function VsDaVinciResolvePage() {
	return (
		<BasePage maxWidth="6xl">
			<div className="flex flex-col gap-12">
				<header className="text-center flex flex-col gap-6">
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
						OpenCut AI vs DaVinci Resolve
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						DaVinci Resolve is the king of color grading and professional post-production. 
						OpenCut AI is the king of <strong>AI-powered, browser-based editing</strong> — 
						text-based editing, one-click filler removal, AI dubbing in 37 languages, 
						and B-roll generation. Free and open source.
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
												DaVinci Resolve
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
													{row.resolve}
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
					<h2 className="text-2xl font-bold">When to use each</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<div className="rounded-lg border p-4 space-y-2">
							<h3 className="font-semibold text-primary">Choose OpenCut AI when:</h3>
							<ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
								<li>You need AI transcription and text-based editing</li>
								<li>You want one-click filler/silence removal (Smart Cut)</li>
								<li>You need AI dubbing in Indian or international languages</li>
								<li>You&apos;re editing on a laptop without a powerful GPU</li>
								<li>You want to edit in the browser without installing software</li>
								<li>You need auto-generated B-roll visuals</li>
								<li>You want karaoke/word-pop subtitles for social media</li>
								<li>Privacy matters — no data should leave your machine</li>
							</ul>
						</div>
						<div className="rounded-lg border p-4 space-y-2">
							<h3 className="font-semibold text-muted-foreground">Choose DaVinci Resolve when:</h3>
							<ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
								<li>You need professional color grading</li>
								<li>You&apos;re doing VFX compositing (Fusion)</li>
								<li>You need Fairlight-level audio post-production</li>
								<li>You&apos;re working on feature films or broadcast TV</li>
								<li>You need advanced keying and tracking</li>
								<li>You have a powerful workstation with a dedicated GPU</li>
							</ul>
						</div>
					</div>
				</section>

				<section className="space-y-4 text-center">
					<h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
					<div className="max-w-2xl mx-auto space-y-4 text-left">
						<FAQ
							question="Can OpenCut AI replace DaVinci Resolve for professional work?"
							answer="It depends on the work. For podcast editing, social media content, talking-head videos, and AI-powered workflows, OpenCut AI is often better. For color grading, VFX, and film production, DaVinci Resolve is the industry standard."
						/>
						<FAQ
							question="Why would I use a browser editor instead of a native app?"
							answer="Zero installation, instant access from any device, no hardware requirements, and automatic updates. OpenCut AI runs on Chromebooks, tablets, and low-end laptops where DaVinci Resolve won't even launch."
						/>
						<FAQ
							question="Does OpenCut AI support color grading?"
							answer="OpenCut AI has basic color adjustments. It's not designed to compete with DaVinci Resolve's industry-leading color science. The focus is on AI-powered editing workflows."
						/>
						<FAQ
							question="Is DaVinci Resolve free?"
							answer="DaVinci Resolve has a free version, but it's not open source. The Studio version costs $295 and is needed for features like neural engine, HDR grading, and some codecs. OpenCut AI is fully free and open source (MIT license)."
						/>
						<FAQ
							question="Can I use both together?"
							answer="Absolutely. Many creators use OpenCut AI for AI transcription, filler removal, and subtitle generation, then export to DaVinci Resolve for color grading and final polish."
						/>
					</div>
				</section>

				<div className="text-center py-8">
					<h2 className="text-2xl font-bold mb-3">
						AI-powered editing — no $295, no GPU, no installation
					</h2>
					<p className="text-muted-foreground mb-6">
						Open your browser and start editing with AI. Free and open source.
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
