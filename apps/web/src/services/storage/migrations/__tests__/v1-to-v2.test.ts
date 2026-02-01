import { describe, expect, test } from "bun:test";
import {
	DEFAULT_BLUR_INTENSITY,
	DEFAULT_CANVAS_SIZE,
	DEFAULT_COLOR,
	DEFAULT_FPS,
} from "@/constants/project-constants";
import { getProjectId, transformProjectV1ToV2 } from "../transformers/v1-to-v2";
import {
	projectWithNoId,
	projectWithNullValues,
	v1Project,
	v1ProjectWithMultipleScenes,
	v2Project,
} from "./fixtures";

describe("V1 to V2 Migration", () => {
	describe("transformProjectV1ToV2", () => {
		test("creates metadata object from flat properties", () => {
			const result = transformProjectV1ToV2({ project: v1Project });

			expect(result.skipped).toBe(false);
			expect(result.project.version).toBe(2);

			const metadata = result.project.metadata as Record<string, unknown>;
			expect(metadata.id).toBe(v1Project.id);
			expect(metadata.name).toBe(v1Project.name);
			expect(typeof metadata.createdAt).toBe("string");
			expect(typeof metadata.updatedAt).toBe("string");
		});

		test("creates settings object from flat properties", () => {
			const result = transformProjectV1ToV2({ project: v1Project });

			const settings = result.project.settings as Record<string, unknown>;
			expect(settings.fps).toBe(v1Project.fps);
			expect(settings.canvasSize).toEqual(v1Project.canvasSize);
		});

		test("converts color background correctly", () => {
			const result = transformProjectV1ToV2({ project: v1Project });

			const settings = result.project.settings as Record<string, unknown>;
			const background = settings.background as Record<string, unknown>;
			expect(background.type).toBe("color");
			expect(background.color).toBe(v1Project.backgroundColor);
		});

		test("converts blur background correctly", () => {
			const projectWithBlur = {
				...v1Project,
				backgroundType: "blur",
				blurIntensity: 30,
			};
			const result = transformProjectV1ToV2({ project: projectWithBlur });

			const settings = result.project.settings as Record<string, unknown>;
			const background = settings.background as Record<string, unknown>;
			expect(background.type).toBe("blur");
			expect(background.blurIntensity).toBe(30);
		});

		test("applies legacy bookmarks to main scene", () => {
			const result = transformProjectV1ToV2({ project: v1Project });

			const scenes = result.project.scenes as Array<Record<string, unknown>>;
			const mainScene = scenes.find((s) => s.isMain === true);
			expect(mainScene?.bookmarks).toEqual(v1Project.bookmarks);
		});

		test("preserves existing scene bookmarks", () => {
			const result = transformProjectV1ToV2({
				project: v1ProjectWithMultipleScenes,
			});

			const scenes = result.project.scenes as Array<Record<string, unknown>>;
			const introScene = scenes.find((s) => s.name === "Intro");
			expect(introScene?.bookmarks).toEqual([1.0]);
		});

		test("skips project that already has v2 structure", () => {
			const result = transformProjectV1ToV2({ project: v2Project });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("already v2");
		});

		test("skips project with no id", () => {
			const result = transformProjectV1ToV2({ project: projectWithNoId });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("no project id");
		});

		test("handles null values gracefully", () => {
			const result = transformProjectV1ToV2({ project: projectWithNullValues });

			expect(result.skipped).toBe(false);
			const settings = result.project.settings as Record<string, unknown>;
			expect(settings.fps).toBe(DEFAULT_FPS);
			expect(settings.canvasSize).toEqual(DEFAULT_CANVAS_SIZE);
		});

		test("uses default values for missing properties", () => {
			const minimalProject = {
				id: "minimal",
				version: 1,
				scenes: [],
			};
			const result = transformProjectV1ToV2({ project: minimalProject });

			const settings = result.project.settings as Record<string, unknown>;
			expect(settings.fps).toBe(DEFAULT_FPS);
			expect(settings.canvasSize).toEqual(DEFAULT_CANVAS_SIZE);

			const background = settings.background as Record<string, unknown>;
			expect(background.type).toBe("color");
			expect(background.color).toBe(DEFAULT_COLOR);
		});

		test("uses default blur intensity when missing", () => {
			const projectWithBlurNoIntensity = {
				id: "blur-no-intensity",
				version: 1,
				backgroundType: "blur",
				scenes: [],
			};
			const result = transformProjectV1ToV2({
				project: projectWithBlurNoIntensity,
			});

			const settings = result.project.settings as Record<string, unknown>;
			const background = settings.background as Record<string, unknown>;
			expect(background.blurIntensity).toBe(DEFAULT_BLUR_INTENSITY);
		});

		test("preserves currentSceneId", () => {
			const result = transformProjectV1ToV2({ project: v1Project });
			expect(result.project.currentSceneId).toBe(v1Project.currentSceneId);
		});

		test("finds main scene id when currentSceneId missing", () => {
			const projectWithoutCurrentScene = {
				...v1Project,
				currentSceneId: undefined,
			};
			const result = transformProjectV1ToV2({
				project: projectWithoutCurrentScene,
			});
			expect(result.project.currentSceneId).toBe("scene-main");
		});
	});

	describe("getProjectId", () => {
		test("returns id from root level", () => {
			const id = getProjectId({ project: v1Project });
			expect(id).toBe("project-v1-123");
		});

		test("returns id from metadata", () => {
			const id = getProjectId({ project: v1ProjectWithMultipleScenes });
			expect(id).toBe("project-v1-multi");
		});
	});
});
