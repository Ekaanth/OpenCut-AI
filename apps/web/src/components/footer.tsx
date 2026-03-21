import Link from "next/link";
import { RiTwitterXLine } from "react-icons/ri";
import { FaGithub } from "react-icons/fa6";
import { SOCIAL_LINKS, UPSTREAM_URL } from "@/constants/site-constants";

const footerLinks = {
	product: [
		{ label: "Editor", href: "/projects" },
		{ label: "Models", href: "/models" },
		{ label: "Roadmap", href: "/roadmap" },
		{ label: "Changelog", href: "/changelog" },
	],
	resources: [
		{ label: "GitHub", href: SOCIAL_LINKS.github },
		{ label: "Contributors", href: "/contributors" },
	],
	legal: [
		{ label: "Privacy", href: "/privacy" },
		{ label: "Terms of use", href: "/terms" },
	],
};

export function Footer() {
	return (
		<footer className="border-t">
			<div className="mx-auto max-w-5xl px-8 py-12">
				<div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr_0.8fr]">
					{/* Brand */}
					<div className="max-w-xs">
						<div className="mb-4 flex items-center gap-2.5">
							<OpenCutAILogo />
							<span className="text-base font-bold tracking-tight">OpenCut AI</span>
						</div>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Open-source AI video editor. Transcribe, edit by text,
							clone voices, and generate visuals. Runs locally on your machine.
						</p>
						<div className="mt-5 flex gap-3">
							<Link
								href={SOCIAL_LINKS.github}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="GitHub"
							>
								<FaGithub className="size-[18px]" />
							</Link>
							<Link
								href={SOCIAL_LINKS.x}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="X / Twitter"
							>
								<RiTwitterXLine className="size-[18px]" />
							</Link>
						</div>
					</div>

					{/* Product links */}
					<div>
						<h3 className="text-sm font-semibold mb-3">Product</h3>
						<ul className="space-y-2">
							{footerLinks.product.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Resources links */}
					<div>
						<h3 className="text-sm font-semibold mb-3">Resources</h3>
						<ul className="space-y-2">
							{footerLinks.resources.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
										target={link.href.startsWith("http") ? "_blank" : undefined}
										rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Legal links */}
					<div>
						<h3 className="text-sm font-semibold mb-3">Legal</h3>
						<ul className="space-y-2">
							{footerLinks.legal.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground hover:text-foreground transition-colors"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-10 flex flex-col items-start justify-between gap-3 border-t pt-6 md:flex-row md:items-center">
					<span className="text-sm text-muted-foreground">
						&copy; {new Date().getFullYear()} OpenCut AI
					</span>
					<span className="text-xs text-muted-foreground/60">
						Forked from{" "}
						<Link
							href={UPSTREAM_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-muted-foreground transition-colors"
						>
							OpenCut
						</Link>
						{" "}&middot; Open source under MIT
					</span>
				</div>
			</div>
		</footer>
	);
}

export function OpenCutAILogo({ size = 26 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			className="shrink-0"
		>
			<defs>
				<linearGradient id="oc-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
					<stop offset="0%" stopColor="#2567EC" />
					<stop offset="100%" stopColor="#37B6F7" />
				</linearGradient>
				<linearGradient id="oc-spark" x1="32" y1="4" x2="44" y2="18" gradientUnits="userSpaceOnUse">
					<stop offset="0%" stopColor="#FFF" />
					<stop offset="100%" stopColor="#FFD96A" />
				</linearGradient>
			</defs>

			{/* Rounded square bg */}
			<rect x="2" y="2" width="44" height="44" rx="13" fill="url(#oc-bg)" />

			{/* Top highlight */}
			<rect x="2" y="2" width="44" height="22" rx="13" fill="white" opacity="0.07" />

			{/* Play triangle */}
			<path d="M19 14L19 34L35 24L19 14Z" fill="white" />

			{/* AI sparkle */}
			<path
				d="M38.5 7L40 11.5L44 13L40 14.5L38.5 19L37 14.5L33 13L37 11.5L38.5 7Z"
				fill="url(#oc-spark)"
			/>

			{/* Small sparkle */}
			<circle cx="9" cy="8" r="1.5" fill="white" opacity="0.4" />
		</svg>
	);
}
