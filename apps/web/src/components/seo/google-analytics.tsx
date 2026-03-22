import Script from "next/script";

/**
 * Google Analytics gtag.js integration.
 * Only renders when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * The measurement ID is read from environment variables, not hardcoded.
 */
export function GoogleAnalytics() {
	const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

	if (!gaId) return null;

	return (
		<>
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
				strategy="afterInteractive"
			/>
			<Script id="google-analytics" strategy="afterInteractive">
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${gaId}', {
						page_path: window.location.pathname,
						anonymize_ip: true,
						cookie_flags: 'SameSite=None;Secure',
					});
				`}
			</Script>
		</>
	);
}
