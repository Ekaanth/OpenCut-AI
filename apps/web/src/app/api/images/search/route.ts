import { type NextRequest, NextResponse } from "next/server";

/**
 * Pexels image search proxy.
 *
 * Accepts ?q=query&per_page=6 and proxies to the Pexels API.
 * The API key is read from the X-Pexels-Api-Key header (client-side localStorage)
 * or from the PEXELS_API_KEY environment variable.
 *
 * Pexels free tier: 200 req/hr, attribution required.
 * https://www.pexels.com/api/documentation/
 */

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q") || "";
		const perPage = Math.min(
			Math.max(Number(searchParams.get("per_page") || "6"), 1),
			30,
		);
		const page = Math.max(Number(searchParams.get("page") || "1"), 1);
		const orientation = searchParams.get("orientation") || "landscape";

		if (!query.trim()) {
			return NextResponse.json(
				{ error: "Query parameter 'q' is required" },
				{ status: 400 },
			);
		}

		// Prefer client header, fall back to server env
		const apiKey =
			request.headers.get("x-pexels-api-key")?.trim() ||
			process.env.PEXELS_API_KEY ||
			"";

		if (!apiKey) {
			return NextResponse.json(
				{
					error: "Pexels API key not configured",
					message:
						"Add a Pexels API key in Settings > API Keys or set PEXELS_API_KEY in .env.local. Get a free key at pexels.com/api.",
				},
				{ status: 401 },
			);
		}

		const params = new URLSearchParams({
			query,
			per_page: perPage.toString(),
			page: page.toString(),
			orientation,
		});

		const response = await fetch(
			`https://api.pexels.com/v1/search?${params.toString()}`,
			{
				headers: { Authorization: apiKey },
			},
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: `Pexels API error: ${response.status}` },
				{ status: response.status },
			);
		}

		const data = await response.json();

		// Transform to a simpler format
		const photos = (data.photos ?? []).map(
			(p: {
				id: number;
				alt: string;
				photographer: string;
				photographer_url: string;
				src: Record<string, string>;
				width: number;
				height: number;
			}) => ({
				id: p.id,
				alt: p.alt || "",
				photographer: p.photographer,
				photographerUrl: p.photographer_url,
				src: {
					small: p.src?.small || p.src?.tiny || "",
					medium: p.src?.medium || p.src?.large || "",
					large: p.src?.large2x || p.src?.large || p.src?.original || "",
				},
				width: p.width,
				height: p.height,
			}),
		);

		return NextResponse.json({
			photos,
			totalResults: data.total_results ?? 0,
			page: data.page ?? page,
			perPage: data.per_page ?? perPage,
			nextPage: data.next_page ?? null,
		});
	} catch (error) {
		console.error("Pexels search error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
