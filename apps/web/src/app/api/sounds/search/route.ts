import { webEnv } from "@opencut-ai/env/web";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const searchParamsSchema = z.object({
	q: z.string().max(500, "Query too long").optional(),
	type: z.enum(["songs", "effects"]).optional(),
	page: z.coerce.number().int().min(1).max(1000).default(1),
	page_size: z.coerce.number().int().min(1).max(150).default(20),
	sort: z
		.enum(["downloads", "rating", "created", "score"])
		.default("downloads"),
	min_rating: z.coerce.number().min(0).max(5).default(3),
	commercial_only: z.coerce.boolean().default(true),
});

const freesoundResultSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().default(""),
	url: z.string(),
	previews: z
		.object({
			"preview-hq-mp3": z.string().optional(),
			"preview-lq-mp3": z.string().optional(),
			"preview-hq-ogg": z.string().optional(),
			"preview-lq-ogg": z.string().optional(),
		})
		.optional(),
	download: z.string().optional(),
	duration: z.number().default(0),
	filesize: z.number().default(0),
	type: z.string().default(""),
	channels: z.number().default(1),
	bitrate: z.number().default(0),
	bitdepth: z.number().default(0),
	samplerate: z.number().default(0),
	username: z.string().default(""),
	tags: z.array(z.string()).default([]),
	license: z.string().default(""),
	created: z.string().default(""),
	num_downloads: z.number().optional(),
	avg_rating: z.number().optional(),
	num_ratings: z.number().optional(),
}).passthrough();

const freesoundResponseSchema = z.object({
	count: z.number().default(0),
	next: z.string().nullable().default(null),
	previous: z.string().nullable().default(null),
	results: z.array(freesoundResultSchema).default([]),
}).passthrough();


function buildSortParameter({ query, sort }: { query?: string; sort: string }) {
	if (!query) return `${sort}_desc`;
	return sort === "score" ? "score" : `${sort}_desc`;
}

function applyEffectsFilters({
	params,
	min_rating,
	commercial_only,
	hasQuery,
}: {
	params: URLSearchParams;
	min_rating: number;
	commercial_only: boolean;
	hasQuery: boolean;
}) {
	params.append("filter", "duration:[* TO 30.0]");
	params.append("filter", `avg_rating:[${min_rating} TO *]`);

	if (commercial_only) {
		params.append(
			"filter",
			'license:("Attribution" OR "Creative Commons 0" OR "Attribution Noncommercial" OR "Attribution Commercial")',
		);
	}

	// Only apply the tag filter when browsing (no query) — let user searches return broad results
	if (!hasQuery) {
		params.append(
			"filter",
			"tag:sound-effect OR tag:sfx OR tag:foley OR tag:ambient OR tag:nature OR tag:mechanical OR tag:electronic OR tag:impact OR tag:whoosh OR tag:explosion",
		);
	}
}

function transformFreesoundResult(
	result: z.infer<typeof freesoundResultSchema>,
) {
	return {
		id: result.id,
		name: result.name,
		description: result.description,
		url: result.url,
		previewUrl:
			result.previews?.["preview-hq-mp3"] ||
			result.previews?.["preview-lq-mp3"],
		downloadUrl: result.download,
		duration: result.duration,
		filesize: result.filesize,
		type: result.type,
		channels: result.channels,
		bitrate: result.bitrate,
		bitdepth: result.bitdepth,
		samplerate: result.samplerate,
		username: result.username,
		tags: result.tags,
		license: result.license,
		created: result.created,
		downloads: result.num_downloads || 0,
		rating: result.avg_rating || 0,
		ratingCount: result.num_ratings || 0,
	};
}

export async function GET(request: NextRequest) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { searchParams } = new URL(request.url);

		const validationResult = searchParamsSchema.safeParse({
			q: searchParams.get("q") || undefined,
			type: searchParams.get("type") || undefined,
			page: searchParams.get("page") || undefined,
			page_size: searchParams.get("page_size") || undefined,
			sort: searchParams.get("sort") || undefined,
			min_rating: searchParams.get("min_rating") || undefined,
		});

		if (!validationResult.success) {
			return NextResponse.json(
				{
					error: "Invalid parameters",
					details: validationResult.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const {
			q: query,
			type,
			page,
			page_size: pageSize,
			sort,
			min_rating,
			commercial_only,
		} = validationResult.data;

		if (type === "songs") {
			return NextResponse.json(
				{
					error: "Songs are not available yet",
					message:
						"Song search functionality is coming soon. Try searching for sound effects instead.",
				},
				{ status: 501 },
			);
		}

		const baseUrl = "https://freesound.org/apiv2/search/text/";

		// Prefer client-provided key (from localStorage) over server env
		const clientApiKey = request.headers.get("x-freesound-api-key");
		const apiKey = clientApiKey || webEnv.FREESOUND_API_KEY;

		if (!apiKey) {
			return NextResponse.json(
				{
					error: "Freesound API key not configured",
					message:
						"Set your Freesound API key in Settings > API Keys, or add FREESOUND_API_KEY to your .env.local file.",
				},
				{ status: 401 },
			);
		}

		const sortParam = buildSortParameter({ query, sort });

		const params = new URLSearchParams({
			query: query || "",
			token: apiKey,
			page: page.toString(),
			page_size: pageSize.toString(),
			sort: sortParam,
			fields:
				"id,name,description,url,previews,download,duration,filesize,type,channels,bitrate,bitdepth,samplerate,username,tags,license,created,num_downloads,avg_rating,num_ratings",
		});

		const isEffectsSearch = type === "effects" || !type;
		if (isEffectsSearch) {
			applyEffectsFilters({ params, min_rating, commercial_only, hasQuery: !!query?.trim() });
		}

		const response = await fetch(`${baseUrl}?${params.toString()}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Freesound API error:", response.status, errorText);
			return NextResponse.json(
				{ error: "Failed to search sounds" },
				{ status: response.status },
			);
		}

		const rawData = await response.json();

		const freesoundValidation = freesoundResponseSchema.safeParse(rawData);
		if (!freesoundValidation.success) {
			console.error(
				"Freesound response parse issue (using raw data):",
				freesoundValidation.error.flatten(),
			);
			// Fall back to raw data — partial results are better than none
			if (rawData?.results) {
				const data = {
					count: rawData.count ?? 0,
					next: rawData.next ?? null,
					previous: rawData.previous ?? null,
					results: Array.isArray(rawData.results) ? rawData.results : [],
				};
				const transformedResults = data.results.map((r: Record<string, unknown>) => ({
					id: r.id,
					name: r.name ?? "Unknown",
					description: r.description ?? "",
					url: r.url ?? "",
					previewUrl: (r.previews as Record<string, string>)?.["preview-hq-mp3"] || (r.previews as Record<string, string>)?.["preview-lq-mp3"],
					downloadUrl: r.download,
					duration: r.duration ?? 0,
					filesize: r.filesize ?? 0,
					type: r.type ?? "",
					channels: r.channels ?? 1,
					bitrate: r.bitrate ?? 0,
					bitdepth: r.bitdepth ?? 0,
					samplerate: r.samplerate ?? 0,
					username: r.username ?? "",
					tags: Array.isArray(r.tags) ? r.tags : [],
					license: r.license ?? "",
					created: r.created ?? "",
					downloads: (r.num_downloads as number) ?? 0,
					rating: (r.avg_rating as number) ?? 0,
					ratingCount: (r.num_ratings as number) ?? 0,
				}));
				return NextResponse.json({
					count: data.count,
					next: data.next,
					previous: data.previous,
					results: transformedResults,
					query: query || "",
					type: type || "effects",
					page,
					pageSize,
					sort,
				});
			}
			return NextResponse.json(
				{ error: "Invalid response from Freesound API" },
				{ status: 502 },
			);
		}

		const data = freesoundValidation.data;

		const transformedResults = data.results.map(transformFreesoundResult);

		const responseData = {
			count: data.count,
			next: data.next,
			previous: data.previous,
			results: transformedResults,
			query: query || "",
			type: type || "effects",
			page,
			pageSize,
			sort,
			minRating: min_rating,
		};

		// Skip strict output validation — the data is already validated from Freesound
		return NextResponse.json(responseData);
	} catch (error) {
		console.error("Error searching sounds:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
