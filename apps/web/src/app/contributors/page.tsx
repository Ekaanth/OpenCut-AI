import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EXTERNAL_TOOLS, SOCIAL_LINKS, UPSTREAM_URL } from "@/constants/site-constants";
import { BasePage } from "../base-page";

export const metadata: Metadata = {
	title: "Contributors - OpenCut AI",
	description:
		"Meet the amazing people who contribute to OpenCut AI, the free and open-source video editor.",
	openGraph: {
		title: "Contributors - OpenCut AI",
		description:
			"Meet the amazing people who contribute to OpenCut AI, the free and open-source video editor.",
		type: "website",
	},
};

interface Contributor {
	id: number;
	login: string;
	avatar_url: string;
	html_url: string;
	contributions: number;
	type: string;
}

async function getContributors(): Promise<Contributor[]> {
	try {
		const response = await fetch(
			"https://api.github.com/repos/OpenCut-app/OpenCut/contributors?per_page=100",
			{
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "OpenCut-Web-App",
				},
				next: { revalidate: 600 }, // 10 minutes
			},
		);

		if (!response.ok) {
			console.error("Failed to fetch contributors");
			return [];
		}

		const contributors = (await response.json()) as Contributor[];

		const filteredContributors = contributors.filter(
			(contributor) => contributor.type === "User",
		);

		return filteredContributors;
	} catch (error) {
		console.error("Error fetching contributors:", error);
		return [];
	}
}

export default async function ContributorsPage() {
	const contributors = await getContributors();
	const topContributors = contributors.slice(0, 2);
	const otherContributors = contributors.slice(2);
	const totalContributions = contributors.reduce(
		(sum, c) => sum + c.contributions,
		0,
	);

	return (
		<BasePage
			title="How this project came together"
			description="OpenCut AI stands on the shoulders of OpenCut and the open-source community. This page tells that story."
		>
			<div className="mx-auto flex max-w-6xl flex-col gap-20">

				{/* Chapter 1: The foundation */}
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60 mb-4">Chapter 1</p>
					<h2 className="text-2xl font-bold mb-4">The foundation</h2>
					<p className="text-muted-foreground leading-relaxed">
						It started with{" "}
						<Link
							href={UPSTREAM_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline font-medium"
						>
							OpenCut
						</Link>
						, an open-source video editor built by a community of {contributors.length}+ contributors.
						They built the timeline, the real-time preview, multi-track editing, effects, keyboard shortcuts,
						and the browser-based storage that makes it all work without a server.
					</p>
				</div>

				{topContributors.length > 0 && (
					<TopContributorsSection contributors={topContributors} />
				)}
				{otherContributors.length > 0 && (
					<AllContributorsSection contributors={otherContributors} />
				)}

				<div className="flex items-center justify-center">
					<Link
						href={UPSTREAM_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
					>
						Star OpenCut on GitHub
					</Link>
				</div>

				{/* Chapter 2: The AI layer */}
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60 mb-4">Chapter 2</p>
					<h2 className="text-2xl font-bold mb-4">The AI layer</h2>
					<p className="text-muted-foreground leading-relaxed">
						The question was simple: what if you could edit a video by editing its transcript?
						What if AI could transcribe, translate, clone voices, generate visuals, and fact-check
						claims, all running on your own machine with no cloud dependency?
					</p>
					<p className="text-muted-foreground leading-relaxed mt-3">
						That question became OpenCut AI. A fork that wraps a complete AI suite around the
						OpenCut editor, adding transcription, text-based editing, voice cloning, filters,
						subtitles, fact-checking, and more. All open source. All local.
					</p>
				</div>

				<div className="flex justify-center">
					<Link
						href="https://github.com/Ekaanth"
						target="_blank"
						rel="noopener noreferrer"
						className="group"
					>
						<Card className="max-w-sm hover:border-primary/30 transition-colors">
							<CardContent className="flex items-center gap-5 p-6">
								<Avatar className="size-16 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all shrink-0">
									<AvatarImage
										src="https://github.com/Ekaanth.png"
										alt="Abhishek"
									/>
									<AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">A</AvatarFallback>
								</Avatar>
								<div>
									<h3 className="text-base font-bold">Abhishek</h3>
									<p className="text-sm text-muted-foreground">@Ekaanth</p>
									<p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
										Forked OpenCut and built the AI layer on top.
									</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>

				{/* Chapter 3: The ecosystem */}
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60 mb-4">Chapter 3</p>
					<h2 className="text-2xl font-bold mb-4">The open-source ecosystem</h2>
					<p className="text-muted-foreground leading-relaxed">
						None of this would work without the broader open-source ecosystem.
						<strong> Whisper</strong> handles transcription.
						<strong> Coqui TTS</strong> generates voices.
						<strong> Ollama</strong> runs LLMs locally.
						<strong> Stable Diffusion</strong> creates images.
						<strong> Next.js</strong>, <strong>React</strong>, <strong>Tailwind</strong>,
						<strong> FastAPI</strong>, and <strong>Docker</strong> hold it all together.
					</p>
					<p className="text-muted-foreground leading-relaxed mt-3">
						Open source means anyone can build powerful tools without gatekeeping
						or cloud lock-in. Thank you to every maintainer and contributor who
						keeps this ecosystem alive.
					</p>
				</div>

				<ExternalToolsSection />

				<GitHubContributeSection
					title="Continue the story"
					description="OpenCut AI is open source. If you want to contribute, fix a bug, add a feature, or just try it out, the code is there."
				/>
			</div>
		</BasePage>
	);
}

function StatItem({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex items-center gap-2">
			<div className="bg-foreground size-2 rounded-full" />
			<span className="font-medium">{value}</span>
			<span className="text-muted-foreground">{label}</span>
		</div>
	);
}

function TopContributorsSection({
	contributors,
}: {
	contributors: Contributor[];
}) {
	return (
		<div className="flex flex-col gap-10">
			<div className="flex flex-col gap-2 text-center">
				<h2 className="text-2xl font-semibold">Top contributors</h2>
				<p className="text-muted-foreground">
					Leading the way in contributions
				</p>
			</div>

			<div className="mx-auto flex w-full max-w-xl flex-col justify-center gap-6 md:flex-row">
				{contributors.map((contributor) => (
					<TopContributorCard key={contributor.id} contributor={contributor} />
				))}
			</div>
		</div>
	);
}

function TopContributorCard({ contributor }: { contributor: Contributor }) {
	return (
		<Link
			href={contributor.html_url}
			target="_blank"
			rel="noopener noreferrer"
			className="w-full"
		>
			<Card>
				<CardContent className="flex flex-col gap-6 p-8 text-center">
					<Avatar className="mx-auto size-28">
						<AvatarImage
							src={contributor.avatar_url}
							alt={`${contributor.login}'s avatar`}
						/>
						<AvatarFallback className="text-lg font-semibold">
							{contributor.login.charAt(0).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-2">
						<h3 className="text-xl font-semibold">{contributor.login}</h3>
						<div className="flex items-center justify-center gap-2">
							<span className="font-medium">{contributor.contributions}</span>
							<span className="text-muted-foreground">contributions</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

function AllContributorsSection({
	contributors,
}: {
	contributors: Contributor[];
}) {
	return (
		<div className="flex flex-col gap-12">
			<div className="flex flex-col gap-2 text-center">
				<h2 className="text-2xl font-semibold">All contributors</h2>
				<p className="text-muted-foreground">
					Everyone who makes OpenCut AI better
				</p>
			</div>

			<div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				{contributors.map((contributor) => (
					<Link
						key={contributor.id}
						href={contributor.html_url}
						target="_blank"
						rel="noopener noreferrer"
						className="opacity-100 hover:opacity-70"
					>
						<div className="flex flex-col items-center gap-2 p-2">
							<Avatar className="size-16">
								<AvatarImage
									src={contributor.avatar_url}
									alt={`${contributor.login}'s avatar`}
								/>
								<AvatarFallback>
									{contributor.login.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="text-center">
								<h3 className="text-sm font-medium">{contributor.login}</h3>
								<p className="text-muted-foreground text-xs">
									{contributor.contributions}
								</p>
							</div>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}

function ExternalToolsSection() {
	return (
		<div className="flex flex-col gap-10">
			<div className="flex flex-col gap-2 text-center">
				<h2 className="text-2xl font-semibold">Built with</h2>
				<p className="text-muted-foreground">The tools and models powering OpenCut AI</p>
			</div>

			<div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{EXTERNAL_TOOLS.map((tool) => (
					<Link
						key={tool.url}
						href={tool.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block"
					>
						<Card className="h-full hover:border-primary/30 transition-colors">
							<CardContent className="flex items-center gap-4 p-5">
								<div className="size-10 rounded-lg border bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
									<Image
										src={tool.logo}
										alt={tool.name}
										width={28}
										height={28}
										className="object-contain"
									/>
								</div>
								<div className="flex-1 min-w-0">
									<h3 className="text-sm font-semibold">{tool.name}</h3>
									<p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
										{tool.description}
									</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
