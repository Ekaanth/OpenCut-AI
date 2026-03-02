import { describe, expect, test } from "bun:test";
import { transformProjectV8ToV9 } from "../transformers/v8-to-v9";

const v8ProjectWithText = {
	id: "project-v8-text",
	version: 8,
	metadata: {
		id: "project-v8-text",
		name: "V8 Project with Text",
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:00.000Z",
	},
	settings: {
		fps: 30,
		canvasSize: { width: 1920, height: 1080 },
		background: { type: "color", color: "#000000" },
	},
	currentSceneId: "scene-main",
	scenes: [
		{
			id: "scene-main",
			name: "Main scene",
			isMain: true,
			tracks: [
				{
					id: "track-text",
					type: "text",
					name: "Text Track",
					hidden: false,
					elements: [
						{
							id: "el-1",
							type: "text",
							content: "With color",
							startTime: 0,
							duration: 5,
							background: {
								color: "#ff0000",
								cornerRadius: 0,
								paddingX: 8,
								paddingY: 4,
							},
						},
						{
							id: "el-2",
							type: "text",
							content: "Transparent",
							startTime: 5,
							duration: 5,
							background: {
								color: "transparent",
								paddingX: 30,
								paddingY: 42,
							},
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		},
	],
} as Parameters<typeof transformProjectV8ToV9>[0]["project"];

describe("V8 to V9 Migration", () => {
	test("adds background.enabled from color (transparent => false, otherwise true)", () => {
		const result = transformProjectV8ToV9({ project: v8ProjectWithText });

		expect(result.skipped).toBe(false);
		expect(result.project.version).toBe(9);

		const track = (
			result.project.scenes as Array<{ tracks: Array<{ elements: unknown[] }> }>
		)[0].tracks[0];
		const elements = track.elements as Array<{ background: { enabled: boolean; color: string } }>;

		expect(elements[0].background.enabled).toBe(true);
		expect(elements[0].background.color).toBe("#ff0000");

		expect(elements[1].background.enabled).toBe(false);
		expect(elements[1].background.color).toBe("transparent");
	});

	test("preserves existing background.enabled if already present", () => {
		const projectWithEnabled = {
			...v8ProjectWithText,
			scenes: [
				{
					...(v8ProjectWithText.scenes as Record<string, unknown>[])[0],
					tracks: [
						{
							id: "track-text",
							type: "text",
							name: "Text Track",
							hidden: false,
							elements: [
								{
									id: "el-1",
									type: "text",
									content: "Already has enabled",
									startTime: 0,
									duration: 5,
									background: {
										enabled: false,
										color: "#00ff00",
									},
								},
							],
						},
					],
				},
			],
		} as Parameters<typeof transformProjectV8ToV9>[0]["project"];

		const result = transformProjectV8ToV9({ project: projectWithEnabled });

		expect(result.skipped).toBe(false);
		const elements = (
			result.project.scenes as Array<{ tracks: Array<{ elements: unknown[] }> }>
		)[0].tracks[0].elements as Array<{ background: { enabled: boolean } }>;
		expect(elements[0].background.enabled).toBe(false);
	});

	test("skips non-text elements and tracks", () => {
		const projectWithVideoOnly = {
			...v8ProjectWithText,
			scenes: [
				{
					id: "scene-main",
					name: "Main scene",
					isMain: true,
					tracks: [
						{
							id: "track-video",
							type: "video",
							name: "Video Track",
							isMain: true,
							elements: [],
						},
					],
					bookmarks: [],
					createdAt: "2024-01-01T00:00:00.000Z",
					updatedAt: "2024-01-01T00:00:00.000Z",
				},
			],
		} as Parameters<typeof transformProjectV8ToV9>[0]["project"];

		const result = transformProjectV8ToV9({ project: projectWithVideoOnly });

		expect(result.skipped).toBe(false);
		expect(result.project.version).toBe(9);
	});

	test("skips projects that are already v9", () => {
		const result = transformProjectV8ToV9({
			project: { ...v8ProjectWithText, version: 9 },
		});

		expect(result.skipped).toBe(true);
		expect(result.reason).toBe("already v9");
	});

	test("skips projects with no id", () => {
		const result = transformProjectV8ToV9({
			project: {
				version: 8,
				scenes: [],
			} as Parameters<typeof transformProjectV8ToV9>[0]["project"],
		});

		expect(result.skipped).toBe(true);
		expect(result.reason).toBe("no project id");
	});
});
