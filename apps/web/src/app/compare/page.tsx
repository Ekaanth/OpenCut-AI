import type { Metadata } from "next";
import Link from "next/link";
import { BasePage } from "@/app/base-page";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "OpenCut AI vs Competitors — Compare Video Editors",
	description:
		"Compare OpenCut AI with Descript, CapCut, and DaVinci Resolve. See why OpenCut AI is the best privacy-first, open-source, AI-powered video editor.",
	alternates: {
		canonical: `${SITE_URL}/compare`,
	},
	openGraph: {
		title: "OpenCut AI vs Competitors",
		description:
			"Side-by-side comparison with Descript, CapCut, and DaVinci Resolve. Privacy-first, open source, AI-powered.",
		url: `${SITE_URL}/compare`,
		type: "website",
	},
};

const COMPARISONS = [
	{
		slug: "vs-descript",
		competitor: "Descript",
		tagline: "Text-based editing leader — $24–65/mo, cloud-only",
		ourAngle: "Same text-based editing, plus AI dubbing, B-roll gen, and 100% local. Free.",
		keyDiffs: [
			"Runs 100% locally (Descript is cloud-only)",
			"AI dubbing in 37 languages vs Descript's limited support",
			"$0 forever vs $288–780/year",
			"Open source (MIT) vs proprietary",
		],
	},
	{
		slug: "vs-capcut",
		competitor: "CapCut",
		tagline: "500M+ users — but owned by ByteDance (TikTok)",
		ourAngle: "Privacy-first editing with professional AI tools. No data collection.",
		keyDiffs: [
			"No ByteDance data collection",
			"Text-based editing + Smart Cut (CapCut has neither)",
			"AI dubbing in 22 Indian languages",
			"No credits, no watermarks, no account required",
		],
	},
	{
		slug: "vs-davinci-resolve",
		competitor: "DaVinci Resolve",
		tagline: "Industry-standard — $295, steep learning curve",
		ourAngle: "Browser-based AI editing for podcasters and content creators. No GPU needed.",
		keyDiffs: [
			"Runs in any browser (no installation, no GPU)",
			"AI transcription, filler removal, auto-chapters",
			"AI dubbing and B-roll generation",
			"$0 forever vs $295 one-time",
		],
	},
];

export default function ComparePage() {
	return (
		<BasePage maxWidth="6xl">
			<div className="flex flex-col gap-12">
				<header className="text-center flex flex-col gap-6">
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
						OpenCut AI vs The Competition
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						The only privacy-first, open-source, self-hosted, AI-powered video editor.
						See how OpenCut AI compares to Descript, CapCut, and DaVinci Resolve.
					</p>
				</header>

				<div className="grid md:grid-cols-3 gap-6">
					{COMPARISONS.map((comp) => (
						<Link
							key={comp.slug}
							href={`/compare/${comp.slug}`}
							className="rounded-lg border p-6 hover:border-primary/50 transition-colors space-y-4"
						>
							<div>
								<h2 className="text-xl font-bold">vs {comp.competitor}</h2>
								<p className="text-sm text-muted-foreground mt-1">{comp.tagline}</p>
							</div>
							<p className="text-sm font-medium text-primary">{comp.ourAngle}</p>
							<ul className="space-y-1.5">
								{comp.keyDiffs.map((diff) => (
									<li key={diff} className="text-xs text-muted-foreground flex items-start gap-2">
										<svg className="size-3.5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
										</svg>
										{diff}
									</li>
								))}
							</ul>
							<span className="inline-flex items-center text-sm text-primary font-medium">
								Full comparison →
							</span>
						</Link>
					))}
				</div>

				<section className="rounded-lg border bg-muted/30 p-6 md:p-8 space-y-4">
					<h2 className="text-2xl font-bold">What makes OpenCut AI different?</h2>
					<div className="grid md:grid-cols-4 gap-6 text-sm">
						<div>
							<h3 className="font-semibold mb-1">Privacy-first</h3>
							<p className="text-muted-foreground">
								100% local processing. No data leaves your machine. No telemetry. 
								No tracking. Perfect for journalists, enterprises, and privacy-conscious creators.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">Self-hosted</h3>
							<p className="text-muted-foreground">
								Deploy on your own infrastructure. Full data sovereignty. 
								Meets enterprise compliance requirements (GDPR, HIPAA-adjacent).
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">AI-powered</h3>
							<p className="text-muted-foreground">
								Transcription, filler removal, AI dubbing (37 languages), B-roll generation, 
								auto-chapters, voice cloning — all running locally.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-1">Open source</h3>
							<p className="text-muted-foreground">
								MIT licensed. Inspect the code, contribute, fork it. No vendor lock-in, 
								no black-box AI, no surprise pricing changes.
							</p>
						</div>
					</div>
				</section>

				<div className="text-center py-8">
					<h2 className="text-2xl font-bold mb-3">
						No subscription. No cloud. No compromises.
					</h2>
					<p className="text-muted-foreground mb-6">
						Open your browser and start editing with AI.
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
