import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_LINKS } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "Terms of Service - OpenCut AI",
	description:
		"OpenCut AI's Terms of Service. Fair, transparent terms for our free and open-source video editor.",
	openGraph: {
		title: "Terms of Service - OpenCut AI",
		description:
			"OpenCut AI's Terms of Service. Fair, transparent terms for our free and open-source video editor.",
		type: "website",
	},
};

export default function TermsPage() {
	return (
		<BasePage
			title="Terms of service"
			description="Fair and transparent terms for our free, open-source video editor. Contact us if you have any questions."
		>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-2xl border px-5"
				>
					<AccordionTrigger className="no-underline!">
						Quick summary
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							You own your content. Everything runs on your machine.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								All processing is local — your content never leaves your machine
							</li>
							<li>
								We make no claims to your content, projects, or generated media
							</li>
							<li>
								Free for personal and commercial use, no watermarks
							</li>
							<li>
								Open source under MIT — review, modify, self-host freely
							</li>
							<li>
								Software provided as-is with no warranties
							</li>
							<li>
								No account required — works fully offline
							</li>
						</ol>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Your Content, Your Rights</h2>
				<p>
					<strong>You own everything you create.</strong> OpenCut AI runs entirely
					on your machine. All video editing, AI transcription, voice generation,
					and image generation happen locally. We have no access to your files,
					projects, or generated content.
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>All processing happens on your hardware — nothing is uploaded</li>
					<li>You retain all intellectual property rights to your content</li>
					<li>AI-generated voiceovers, images, and subtitles belong to you</li>
					<li>No watermarks, no licensing restrictions</li>
					<li>Export and use your content however you choose</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">How You Can Use OpenCut AI</h2>
				<p>OpenCut AI is free for personal and commercial use. You can:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Create videos for personal, educational, or commercial purposes
					</li>
					<li>Use OpenCut AI for client work and paid projects</li>
					<li>Share and distribute videos created with OpenCut AI</li>
					<li>
						Modify and distribute the OpenCut AI software (under MIT license)
					</li>
				</ul>
				<p>
					<strong>What we ask:</strong> Don't use OpenCut AI for illegal
					activities, harassment, or creating harmful content. Be respectful of
					others and follow applicable laws.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">
					AI Features and Processing
				</h2>
				<p>
					All AI features run locally on your machine via Docker containers:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Transcription (Whisper), TTS (Coqui XTTS), LLM (Ollama), and image generation
						(Stable Diffusion) run on your hardware
					</li>
					<li>No AI processing is done on external servers unless you explicitly configure API keys</li>
					<li>
						Open-source AI models can be swapped, updated, or removed at your discretion
					</li>
					<li>
						Voice cloning uses only the audio samples you provide locally
					</li>
				</ul>
				<p>
					If you add optional external API keys (OpenAI, ElevenLabs, etc.),
					those services process data per their own terms. This is your choice.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Account and Service</h2>
				<p>To use certain features, you may create an account:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Provide accurate information when signing up</li>
					<li>Keep your account secure and don't share credentials</li>
					<li>You're responsible for activity under your account</li>
					<li>You can delete your account at any time</li>
				</ul>
				<p>
					OpenCut AI is provided "as is" without warranties. While we strive for
					reliability, we can't guarantee uninterrupted service.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Open Source Benefits</h2>
				<p>Because OpenCut AI is open source, you have additional rights:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Review our code to see exactly how we handle your data</li>
					<li>Self-host OpenCut AI on your own servers</li>
					<li>Modify the software to suit your needs</li>
					<li>Contribute improvements back to the community</li>
				</ul>
				<p>
					View our source code and license on{" "}
					<a
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						GitHub
					</a>
					.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Third-Party Content</h2>
				<p>
					When using OpenCut AI, make sure you have the right to use any content
					you import:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Only upload content you own or have permission to use</li>
					<li>
						Respect copyright, trademarks, and other intellectual property
					</li>
					<li>
						Don't use copyrighted music, images, or videos without permission
					</li>
					<li>You're responsible for any claims related to your content</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Limitations and Liability</h2>
				<p>
					OpenCut AI is provided free of charge. To the extent permitted by law:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We're not liable for any loss of data or content</li>
					<li>
						Projects are stored in your browser and may be lost if you clear
						browser data
					</li>
					<li>We're not responsible for how you use the service</li>
					<li>Our liability is limited to the maximum extent allowed by law</li>
				</ul>
				<p>
					Since your content stays on your device, we have no way to recover
					lost projects. Consider exporting important videos when finished
					editing.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Service Changes</h2>
				<p>We may update OpenCut AI and these terms:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We'll notify you of significant changes to these terms</li>
					<li>Continued use means you accept any updates</li>
					<li>You can always self-host an older version if you prefer</li>
					<li>Major changes will be discussed with the community on GitHub</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Termination</h2>
				<p>You can stop using OpenCut AI at any time:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Delete your account through your profile settings</li>
					<li>Clear your browser data to remove local projects</li>
					<li>Your content remains yours even if you stop using OpenCut AI</li>
					<li>We may suspend accounts for violations of these terms</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact Us</h2>
				<p>Questions about these terms or need to report an issue?</p>
				<p>
					Contact us through our{" "}
					<a
						href={`${SOCIAL_LINKS.github}/issues`}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						GitHub repository
					</a>
					, or reach out on{" "}
					<a
						href={SOCIAL_LINKS.x}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						X (Twitter)
					</a>
					.
				</p>
				<p>
					These terms are governed by applicable law in your jurisdiction. We
					prefer to resolve disputes through friendly discussion in our
					open-source community.
				</p>
			</section>
			<Separator />
			<p className="text-muted-foreground text-sm">
				Last updated: March 22, 2026
			</p>
		</BasePage>
	);
}
