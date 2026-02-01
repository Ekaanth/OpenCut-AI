export const v1Project = {
	id: "project-v1-123",
	version: 1,
	name: "My V1 Project",
	createdAt: "2024-01-15T10:00:00.000Z",
	updatedAt: "2024-01-15T12:00:00.000Z",
	fps: 30,
	canvasSize: { width: 1920, height: 1080 },
	backgroundColor: "#1a1a1a",
	backgroundType: "color",
	currentSceneId: "scene-main",
	bookmarks: [2.0, 4.5, 7.0],
	scenes: [
		{
			id: "scene-main",
			name: "Main scene",
			isMain: true,
			tracks: [
				{
					id: "track-1",
					type: "video",
					name: "Video Track",
					isMain: true,
					elements: [
						{
							id: "element-1",
							type: "video",
							mediaId: "media-1",
							startTime: 0,
							duration: 10,
							trimStart: 0,
							trimEnd: 0,
						},
					],
				},
				{
					id: "track-2",
					type: "audio",
					name: "Audio Track",
					elements: [
						{
							id: "element-2",
							type: "audio",
							sourceType: "upload",
							mediaId: "media-2",
							startTime: 0,
							duration: 10,
							trimStart: 0,
							trimEnd: 0,
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-01-15T10:00:00.000Z",
			updatedAt: "2024-01-15T12:00:00.000Z",
		},
	],
};

export const v1ProjectWithMultipleScenes = {
	id: "project-v1-multi",
	version: 1,
	metadata: {
		id: "project-v1-multi",
		name: "Multi-Scene Project",
		createdAt: "2024-02-20T14:00:00.000Z",
		updatedAt: "2024-02-20T16:00:00.000Z",
	},
	currentSceneId: "scene-1",
	fps: 60,
	canvasSize: { width: 3840, height: 2160 },
	background: { type: "blur", blurIntensity: 15 },
	scenes: [
		{
			id: "scene-1",
			name: "Intro",
			isMain: true,
			tracks: [
				{
					id: "track-1",
					type: "video",
					isMain: true,
					elements: [
						{
							id: "el-1",
							type: "video",
							mediaId: "m1",
							startTime: 0,
							duration: 5,
						},
					],
				},
			],
			bookmarks: [1.0],
			createdAt: "2024-02-20T14:00:00.000Z",
			updatedAt: "2024-02-20T16:00:00.000Z",
		},
		{
			id: "scene-2",
			name: "Content",
			isMain: false,
			tracks: [
				{
					id: "track-2",
					type: "video",
					isMain: true,
					elements: [
						{
							id: "el-2",
							type: "video",
							mediaId: "m2",
							startTime: 0,
							duration: 20,
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-02-20T14:30:00.000Z",
			updatedAt: "2024-02-20T16:00:00.000Z",
		},
	],
};