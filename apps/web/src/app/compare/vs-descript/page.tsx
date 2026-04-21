import type { Metadata } from "next";
import Link from "next/link";
import { BasePage } from "@/app/base-page";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "OpenCut AI vs Descript — Privacy-First Open Source Alternative",
	description:
		"OpenCut AI is the free, open-source, self-hosted alternative to Descript. Compare features: AI transcription, text-based editing, filler word removal, voice cloning, multi-speaker detection, and 22 Indian languages. No cloud. No subscription. No data leaves your machine.",
	alternates: {
		canonical: `${SITE_URL}/compare/vs-descript`,
	},
	openGraph: {
		title: "OpenCut AI vs Descript — Privacy-First Open Source Alternative",
		description:
			"Descript charges $24–65/mo and sends your media to the cloud. OpenCut AI is free, self-hosted, open source, and runs 100% locally.",
		url: `${SITE_URL}/compare/vs-descript`,
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenCut AI vs Descript",
		description:
			"Free, open-source, self-hosted alternative to Descript. 100% local. No subscription.",
	},
};

const FEATURES = [
	{
		category: "Core Editing",
		rows: [
			{ feature: "Text-based editing", opencut: "Yes", descript: "Yes" },
			{ feature: "Timeline-based editing", opencut: "Yes", descript: "Yes" },
			{ feature: "Multi-track support", opencut: "Yes", descript: "Yes" },
			{ feature: "Transitions library", opencut: "7 types", descript: "Limited" },
			{ feature: "Speed ramping", opencut: "Yes", descript: "Basic" },
			{ feature: "Audio mixer with meters", opencut: "Yes", descript: "Yes" },
			{ feature: "Proxy editing (4K+)", opencut: "Yes", descript: "Yes" },
		],
	},
	{
		category: "AI Features",
		rows: [
			{ feature: "AI transcription", opencut: "Whisper (local)", descript: "Cloud-based" },
			{ feature: "Filler word removal", opencut: "Yes", descript: "Yes" },
			{ feature: "Silence detection", opencut: "Yes", descript: "Yes" },
			{ feature: "Smart Cut (one-click)", opencut: "Yes", descript: "No" },
			{ feature: "AI voice cloning", opencut: "XTTS v2 (local)", descript: "Overdub (cloud)" },
			{ feature: "AI dubbing / translation", opencut: "22 Indian langs + 15 more", descript: "Limited" },
			{ feature: "Auto-chapters", opencut: "Yes", descript: "Yes" },
			{ feature: "B-roll generation", opencut: "Image + Video AI", descript: "No" },
			{ feature: "AI text-to-speech", opencut: "Local + cloud options", descript: "Cloud only" },
		],
	},
	{
		category: "Privacy & Deployment",
		rows: [
			{ feature: "Runs 100% locally", opencut: "Yes", descript: "No" },
			{ feature: "Self-hosted option", opencut: "Yes", descript: "No" },
			{ feature: "Open source", opencut: "Yes (MIT)", descript: "No" },
			{ feature: "Data stays on your machine", opencut: "Always", descript: "No" },
			{ feature: "No internet required", opencut: "Yes", descript: "No" },
			{ feature: "Enterprise data sovereignty", opencut: "Built-in", descript: "Enterprise plan" },
		],
	},
	{
		category: "Pricing",
		rows: [
			{ feature: "Free tier", opencut: "Unlimited, full features", descript: "1 hr/mo, watermarked" },
			{ feature: "Paid plan", opencut: "$0 forever", descript: "$24–65/mo" },
			{ feature: "Annual cost", opencut: "$0", descript: "$288–780" },
		],
	},
	{
		category: "Subtitles & Accessibility",
		rows: [
			{ feature: "Karaoke subtitles", opencut: "Yes", descript: "No" },
			{ feature: "Word-pop subtitles", opencut: "Yes", descript: "No" },
			{ feature: "Multi-speaker subtitles", opencut: "Yes", descript: "Yes" },
			{ feature: "Indian language support", opencut: "22 languages", descript: "None" },
			{ feature: "Auto-reframe (9:16)", opencut: "Yes", descript: "Yes" },
		],
	},
];

function CheckIcon() {
	return (
		<svg className="size-4 text-green-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	);
}

function CrossIcon() {
	return (
		<svg className="size-4 text-red-400 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}

export default function VsDescriptPage() {
	return (
		<BasePage maxWidth="6xl">
			<div className="flex flex-col gap-12">
				<header className="text-center flex flex-col gap-6">
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
						OpenCut AI vs Descript
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						Descript pioneered text-based video editing. OpenCut AI takes it further — 
						with <strong>AI dubbing in 37 languages</strong>, <strong>B-roll generation</strong>, 
						and <strong>100% local processing</strong>. Free, open-source, and self-hosted.
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
												Descript
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
													{row.descript}
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
					<h2 className="text-2xl font-bold">Why switch from Descript?</h2>
					<div className="grid md:grid-cols-3 gap-6">
						<div>
							<h3 className="font-semibold mb-1">Privacy by default</h3>
							<p className="text-sm text-muted-foreground">
								Descript uploads every recording to their cloud. OpenCut AI processes everything 
								on your machine. No server, no API calls, no data leaves your device. Ideal for 
								journalists, enterprises, and privacy-conscious creators.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">Save $288–780/year</h3>
							<p className="text-sm text-muted-foreground">
								Descript&apos;s Hobby plan is $24/mo and Pro is $65/mo. OpenCut AI is free forever 
								with all features unlocked. No watermarks, no time limits, no credit system.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">37 languages, 22 Indian</h3>
							<p className="text-sm text-muted-foreground">
								Via Sarvam AI and Smallest AI, OpenCut AI supports transcription, translation, 
								and AI dubbing in 22 Indian languages + 15 international languages. Descript 
								offers none of this.
							</p>
						</div>
					</div>
				</section>

				<section className="space-y-4 text-center">
					<h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
					<div className="max-w-2xl mx-auto space-y-4 text-left">
						<FAQ
							question="Can I import my Descript projects into OpenCut AI?"
							answer="Not directly, but you can import the same source media files. OpenCut AI supports all common video, audio, and image formats."
						/>
						<FAQ
							question="Does OpenCut AI have screen recording like Descript?"
							answer="OpenCut AI focuses on editing rather than recording. You can bring in screen recordings from OBS or any other tool and edit them with all AI features."
						/>
						<FAQ
							question="Is the AI transcription as accurate as Descript?"
							answer="OpenCut AI uses Faster Whisper (CTranslate2), which provides state-of-the-art accuracy matching or exceeding cloud-based services. It runs locally on your hardware."
						/>
						<FAQ
							question="Can my team collaborate like we do in Descript?"
							answer="OpenCut AI is designed for individual use right now. For team workflows, you can self-host and share projects via file sync. Multi-user collaboration is on the roadmap."
						/>
					</div>
				</section>

				<div className="text-center py-8">
					<h2 className="text-2xl font-bold mb-3">Ready to try the privacy-first alternative?</h2>
					<p className="text-muted-foreground mb-6">
						No sign-up. No credit card. No cloud. Just open your browser and start editing.
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
