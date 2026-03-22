import { SITE_INFO, SITE_URL, SOCIAL_LINKS } from "@/constants/site-constants";

/**
 * JSON-LD structured data for SEO.
 * Renders Organization, WebSite, and SoftwareApplication schemas.
 */
export function JsonLd() {
	const organization = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: SITE_INFO.title,
		url: SITE_URL,
		logo: `${SITE_URL}/favicon.svg`,
		description: SITE_INFO.description,
		sameAs: [
			SOCIAL_LINKS.github,
			SOCIAL_LINKS.x,
		],
	};

	const website = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: SITE_INFO.title,
		url: SITE_URL,
		description: SITE_INFO.description,
		potentialAction: {
			"@type": "SearchAction",
			target: `${SITE_URL}/blog?q={search_term_string}`,
			"query-input": "required name=search_term_string",
		},
	};

	const softwareApp = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_INFO.title,
		url: SITE_URL,
		description: SITE_INFO.description,
		applicationCategory: "MultimediaApplication",
		applicationSubCategory: "Video Editor",
		operatingSystem: "Web, Windows, macOS, Linux",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		featureList: [
			"AI-powered podcast clip generation",
			"Multi-speaker diarization with pyannote",
			"Word-pop karaoke subtitles (Hormozi style)",
			"Auto-reframe 16:9 to 9:16 with face tracking",
			"Brand kit with logo, colors, intro/outro cards",
			"AI question card generation",
			"Emotion detection with SpeechBrain",
			"Speed control 0.1x to 4x",
			"AI transcription with Whisper",
			"Voice cloning with XTTS v2",
			"Text-based video editing",
			"Filler word auto-removal",
			"Image generation with Stable Diffusion",
			"Multi-language subtitle translation",
			"100% local processing, no cloud",
		],
		screenshot: `${SITE_URL}${SITE_INFO.openGraphImage}`,
		softwareVersion: "1.0.0",
		license: "https://opensource.org/licenses/MIT",
		isAccessibleForFree: true,
	};

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
			/>
		</>
	);
}
