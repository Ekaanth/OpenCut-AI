import { defineCollection, defineConfig } from "@content-collections/core";
import { z } from "zod";

const changelog = defineCollection({
	name: "changelog",
	directory: "content/changelog",
	include: "*.md",
	schema: z.object({
		version: z.string(),
		date: z.string(),
		title: z.string(),
		description: z.string().optional(),
		changes: z.array(
			z.object({
				type: z.string(),
				text: z.string(),
			}),
		),
	}),
	transform: async (doc, { collection }) => {
		const allDocs = await collection.documents();
		const sorted = [...allDocs].sort((a, b) =>
			b.version.localeCompare(a.version, undefined, { numeric: true }),
		);
		const isLatest = sorted[0]?.version === doc.version;
		return { ...doc, isLatest };
	},
});

export default defineConfig({
	content: [changelog],
});
