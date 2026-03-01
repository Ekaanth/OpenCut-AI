import { afterEach, describe, expect, test } from "bun:test";
import { EditorCore } from "@/core";
import type { TimelineTrack, VideoElement } from "@/types/timeline";
import { DEFAULT_TRANSFORM } from "@/constants/timeline-constants";
import { UpdateElementDurationCommand } from "@/lib/commands/timeline/element/update-element-duration";
import { UpdateElementTrimCommand } from "@/lib/commands/timeline/element/update-element-trim";
import { SplitElementsCommand } from "@/lib/commands/timeline/element/split-elements";
import { DuplicateElementsCommand } from "@/lib/commands/timeline/element/duplicate-elements";
import { UpsertKeyframeCommand } from "@/lib/commands/timeline/element/keyframes/upsert-keyframe";
import { RemoveKeyframeCommand } from "@/lib/commands/timeline/element/keyframes/remove-keyframe";
import { RetimeKeyframeCommand } from "@/lib/commands/timeline/element/keyframes/retime-keyframe";

type MockEditor = {
	timeline: {
		getTracks: () => TimelineTrack[];
		updateTracks: (tracks: TimelineTrack[]) => void;
	};
	selection: {
		getSelectedElements: () => { trackId: string; elementId: string }[];
		setSelectedElements: ({
			elements,
		}: {
			elements: { trackId: string; elementId: string }[];
		}) => void;
	};
};

const originalGetInstance = EditorCore.getInstance;

function mockEditorCore({ editor }: { editor: MockEditor }): void {
	(
		EditorCore as unknown as {
			getInstance: () => EditorCore;
		}
	).getInstance = () => editor as unknown as EditorCore;
}

function restoreEditorCore(): void {
	(
		EditorCore as unknown as {
			getInstance: typeof EditorCore.getInstance;
		}
	).getInstance = originalGetInstance;
}

function buildVideoElement(): VideoElement {
	return {
		id: "element-1",
		name: "Clip",
		type: "video",
		mediaId: "media-1",
		duration: 8,
		startTime: 1,
		trimStart: 0,
		trimEnd: 0,
		transform: DEFAULT_TRANSFORM,
		opacity: 1,
		animations: {
			channels: {
				"transform.scale": {
					valueKind: "number",
					keyframes: [
						{ id: "kf-a", time: 0, value: 1, interpolation: "linear" },
						{ id: "kf-b", time: 3, value: 1.5, interpolation: "linear" },
						{ id: "kf-c", time: 6, value: 2, interpolation: "linear" },
					],
				},
			},
		},
	};
}

function buildTracks({ element }: { element: VideoElement }): TimelineTrack[] {
	return [
		{
			id: "track-1",
			name: "Main",
			type: "video",
			elements: [element],
			isMain: true,
			muted: false,
			hidden: false,
		},
	];
}

afterEach(() => {
	restoreEditorCore();
});

describe("keyframe-aware timeline commands", () => {
	test("duration updates clamp keyframes beyond the new duration", () => {
		const tracks = buildTracks({ element: buildVideoElement() });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new UpdateElementDurationCommand({
			trackId: "track-1",
			elementId: "element-1",
			duration: 3,
		}).execute();

		const updatedElement = (updatedTracks[0].elements[0] as VideoElement).animations;
		expect(
			updatedElement?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 3]);
	});

	test("trim updates clamp keyframes when duration is changed", () => {
		const tracks = buildTracks({ element: buildVideoElement() });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new UpdateElementTrimCommand({
			elementId: "element-1",
			trimStart: 0,
			trimEnd: 0,
			startTime: 1,
			duration: 2,
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		expect(updatedElement.duration).toBe(2);
		expect(
			updatedElement.animations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0]);
	});

	test("split rebases right-side keyframes and keeps continuity at split time", () => {
		const tracks = buildTracks({ element: buildVideoElement() });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new SplitElementsCommand({
			elements: [{ trackId: "track-1", elementId: "element-1" }],
			splitTime: 5,
		}).execute();

		const leftElement = updatedTracks[0].elements.find(
			(element) => element.id === "element-1",
		) as VideoElement;
		const rightElement = updatedTracks[0].elements.find(
			(element) => element.id !== "element-1",
		) as VideoElement;

		expect(
			leftElement.animations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 3, 4]);
		expect(
			rightElement.animations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 2]);
		expect(
			rightElement.animations?.channels["transform.scale"]?.keyframes[0]?.value,
		).toBeCloseTo(5 / 3, 4);
	});

	test("duplicate creates independent keyframe ids for copied element", () => {
		const tracks = buildTracks({ element: buildVideoElement() });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [{ trackId: "track-1", elementId: "element-1" }],
					setSelectedElements: () => {},
				},
			},
		});

		new DuplicateElementsCommand({
			elements: [{ trackId: "track-1", elementId: "element-1" }],
		}).execute();

		const originalElement = updatedTracks.find(
			(track) => track.id === "track-1",
		)?.elements[0] as VideoElement;
		const duplicatedTrack = updatedTracks.find((track) => track.id !== "track-1");
		const duplicatedElement = duplicatedTrack?.elements[0] as VideoElement;

		expect(duplicatedElement).toBeDefined();
		expect(
			duplicatedElement.animations?.channels["transform.scale"]?.keyframes.map(
				(keyframe) => keyframe.time,
			),
		).toEqual([0, 3, 6]);
		expect(
			duplicatedElement.animations?.channels["transform.scale"]?.keyframes[0]?.id,
		).not.toBe(
			originalElement.animations?.channels["transform.scale"]?.keyframes[0]?.id,
		);
	});
});

describe("generic keyframe commands", () => {
	test("upsert adds or updates keyframe at target time", () => {
		const element = buildVideoElement();
		const tracks = buildTracks({ element });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new UpsertKeyframeCommand({
			trackId: "track-1",
			elementId: "element-1",
			propertyPath: "transform.scale",
			time: 2,
			value: 2.5,
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		const keyframes =
			updatedElement.animations?.channels["transform.scale"]?.keyframes ?? [];
		const atTwo = keyframes.find((keyframe) => Math.abs(keyframe.time - 2) < 0.001);
		expect(atTwo?.value).toBe(2.5);
	});

	test("remove deletes keyframe by id", () => {
		const element = buildVideoElement();
		const tracks = buildTracks({ element });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new RemoveKeyframeCommand({
			trackId: "track-1",
			elementId: "element-1",
			propertyPath: "transform.scale",
			keyframeId: "kf-b",
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		const keyframes =
			updatedElement.animations?.channels["transform.scale"]?.keyframes ?? [];
		expect(keyframes).toHaveLength(2);
		expect(keyframes.find((keyframe) => keyframe.id === "kf-b")).toBeUndefined();
		expect(updatedElement.transform.scale).toBe(1);
	});

	test("remove persists value to base property when channel becomes empty", () => {
		const element: VideoElement = {
			...buildVideoElement(),
			transform: {
				...DEFAULT_TRANSFORM,
				scale: 1,
			},
			animations: {
				channels: {
					"transform.scale": {
						valueKind: "number",
						keyframes: [
							{
								id: "only-scale",
								time: 2,
								value: 1.43,
								interpolation: "linear",
							},
						],
					},
				},
			},
		};
		const tracks = buildTracks({ element });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new RemoveKeyframeCommand({
			trackId: "track-1",
			elementId: "element-1",
			propertyPath: "transform.scale",
			keyframeId: "only-scale",
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		expect(updatedElement.transform.scale).toBe(1.43);
		expect(updatedElement.animations?.channels["transform.scale"]).toBeUndefined();
	});

	test("upsert supports non-transform paths like opacity", () => {
		const element = buildVideoElement();
		const tracks = buildTracks({ element });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new UpsertKeyframeCommand({
			trackId: "track-1",
			elementId: "element-1",
			propertyPath: "opacity",
			time: 1,
			value: 0.35,
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		const opacityChannel = updatedElement.animations?.channels.opacity;
		expect(opacityChannel?.valueKind).toBe("number");
		expect(opacityChannel?.keyframes[0]?.value).toBe(0.35);
	});

	test("retime moves keyframe to new time", () => {
		const element = buildVideoElement();
		const tracks = buildTracks({ element });
		let updatedTracks: TimelineTrack[] = tracks;
		mockEditorCore({
			editor: {
				timeline: {
					getTracks: () => tracks,
					updateTracks: (nextTracks) => {
						updatedTracks = nextTracks;
					},
				},
				selection: {
					getSelectedElements: () => [],
					setSelectedElements: () => {},
				},
			},
		});

		new RetimeKeyframeCommand({
			trackId: "track-1",
			elementId: "element-1",
			propertyPath: "transform.scale",
			keyframeId: "kf-b",
			nextTime: 4,
		}).execute();

		const updatedElement = updatedTracks[0].elements[0] as VideoElement;
		const keyframe = updatedElement.animations?.channels["transform.scale"]?.keyframes.find(
			(existingKeyframe) => existingKeyframe.id === "kf-b",
		);
		expect(keyframe?.time).toBe(4);
	});
});
