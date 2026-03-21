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
	title: "Privacy Policy - OpenCut AI",
	description:
		"Learn how OpenCut AI handles your data and privacy. Our commitment to protecting your information while you edit videos.",
	openGraph: {
		title: "Privacy Policy - OpenCut AI",
		description:
			"Learn how OpenCut AI handles your data and privacy. Our commitment to protecting your information while you edit videos.",
		type: "website",
	},
};

export default function PrivacyPage() {
	return (
		<BasePage
			title="Privacy policy"
			description="Learn how we handle your data and privacy. Contact us if you have any questions."
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
							Your data never leaves your machine.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								All editing and AI processing happens locally on your machine or self-hosted server
							</li>
							<li>
								No video, audio, or project data is uploaded to any cloud service
							</li>
							<li>
								AI models (Whisper, TTS, Ollama, Stable Diffusion) run on your hardware
							</li>
							<li>Project data is stored in your browser using IndexedDB</li>
							<li>No analytics, no telemetry, no tracking of any kind</li>
							<li>No account required — the editor works without sign-in</li>
							<li>The entire codebase is open source and auditable</li>
						</ol>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">How We Handle Your Content</h2>
				<p>
					<strong>Everything runs locally.</strong>{" "}
					OpenCut AI is a self-hosted application. All video editing, AI transcription,
					voice generation, image generation, and other AI features run on your
					machine or your self-hosted server. No data is sent to any external cloud service.
				</p>
				<p>
					Your video files, audio files, project data, and generated content
					never leave your infrastructure. The AI models (Whisper, Coqui TTS,
					Ollama, Stable Diffusion) run locally inside Docker containers on your hardware.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">AI Processing</h2>
				<p>All AI features process data locally:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						<strong>Transcription:</strong> Whisper runs on your machine — audio is processed locally
					</li>
					<li>
						<strong>Voice generation:</strong> Coqui XTTS v2 runs in a local Docker container
					</li>
					<li>
						<strong>LLM commands:</strong> Ollama runs models locally — no API calls to OpenAI or others
					</li>
					<li>
						<strong>Image generation:</strong> Stable Diffusion runs on your GPU/CPU
					</li>
					<li>
						<strong>Fact checking:</strong> Uses the local LLM, not external APIs
					</li>
				</ul>
				<p>
					If you configure optional external API keys (OpenAI, ElevenLabs, etc.)
					in Settings, those services will receive data per their own privacy policies.
					This is entirely opt-in.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Data Storage</h2>
				<p>
					Project data is stored in your browser using IndexedDB. No account
					is required. Nothing is stored on external servers.
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Projects, timelines, and settings are stored in your browser</li>
					<li>API keys you enter are stored in browser localStorage</li>
					<li>Generated audio/images are stored in Docker volumes on your machine</li>
					<li>Clear your browser data at any time to remove everything</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Analytics & Tracking</h2>
				<p>
					OpenCut AI does not include any analytics, telemetry, or tracking.
					No data is sent to any external service. The application operates
					entirely offline once loaded.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Local Storage & Cookies</h2>
				<p>We use browser local storage and IndexedDB to:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Save your projects locally on your device</li>
					<li>Remember your editor preferences and settings</li>
					<li>Keep you logged in across browser sessions</li>
				</ul>
				<p>
					All data stays on your device and can be cleared at any time through
					your browser settings.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Third-Party Services</h2>
				<p>By default, OpenCut AI does not connect to any third-party services. Optional integrations:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						<strong>Freesound:</strong> Sound library search (requires API key in Settings)
					</li>
					<li>
						<strong>OpenAI / ElevenLabs:</strong> Optional cloud AI APIs (requires API keys in Settings)
					</li>
					<li>
						<strong>Ollama model registry:</strong> Model downloads when pulling new LLM models
					</li>
				</ul>
				<p>None of these are enabled by default. You choose what to connect.</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Your Rights</h2>
				<p>You have complete control over your data:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Delete your account and all associated data at any time</li>
					<li>Export your project data</li>
					<li>Clear local storage to remove all saved projects</li>
					<li>Contact us with any privacy concerns</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Open Source Transparency</h2>
				<p>
					OpenCut AI is completely open source. You can review our code, see
					exactly how we handle data, and even self-host the application if you
					prefer.
				</p>
				<p>
					View our source code on{" "}
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
				<h2 className="text-2xl font-semibold">Contact Us</h2>
				<p>Questions about this privacy policy or how we handle your data?</p>
				<p>
					Open an issue on our{" "}
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
			</section>

			<Separator />

			<p className="text-muted-foreground text-sm">
				Last updated: March 22, 2026
			</p>
		</BasePage>
	);
}
