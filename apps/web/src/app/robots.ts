import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/site-constants";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/_next/", "/projects/", "/editor/", "/api/"],
			},
			{
				userAgent: "Googlebot",
				allow: "/",
				disallow: ["/_next/", "/projects/", "/editor/", "/api/"],
			},
		],
		sitemap: `${SITE_URL}/sitemap.xml`,
		host: SITE_URL,
	};
}
