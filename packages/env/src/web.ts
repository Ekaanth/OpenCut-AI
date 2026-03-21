import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.url().default("https://api.marblecms.com"),
	NEXT_PUBLIC_AI_BACKEND_URL: z.url().default("http://localhost:8420"),

	// Server — required for the app to function
	DATABASE_URL: z
		.string()
		.startsWith("postgres://")
		.or(z.string().startsWith("postgresql://")),

	BETTER_AUTH_SECRET: z.string(),
	UPSTASH_REDIS_REST_URL: z.url().default("http://localhost:8079"),
	UPSTASH_REDIS_REST_TOKEN: z.string().default("example_token"),

	// Optional — features degrade gracefully without these
	MARBLE_WORKSPACE_KEY: z.string().default(""),
	FREESOUND_CLIENT_ID: z.string().default(""),
	FREESOUND_API_KEY: z.string().default(""),
	CLOUDFLARE_ACCOUNT_ID: z.string().default(""),
	R2_ACCESS_KEY_ID: z.string().default(""),
	R2_SECRET_ACCESS_KEY: z.string().default(""),
	R2_BUCKET_NAME: z.string().default("opencut-transcription"),
	MODAL_TRANSCRIPTION_URL: z.url().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
