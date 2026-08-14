import type { CanvasRenderer } from "../canvas-renderer";
import { createOffscreenCanvas } from "../canvas-utils";
import { BaseNode } from "./base-node";
import { VideoNode } from "./video-node";
import { ImageNode } from "./image-node";
import type { Transform } from "@/types/timeline";
import type { Effect } from "@/types/effects";
import type { BlendMode } from "@/types/rendering";
import type { ElementAnimations } from "@/types/animation";
import { renderTransition } from "../transition-renderer";
import { getTransition } from "@/lib/transitions";

export interface TransitionSourceParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	playbackRate?: number;
	transform: Transform;
	animations?: ElementAnimations;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
	/** Media backing this side of the transition, if any (video/image only). */
	mediaId?: string;
	mediaType?: "video" | "image";
}

export interface TransitionNodeParams {
	transitionType: string;
	transitionDuration: number;
	cutTime: number;
	sourceA: TransitionSourceParams;
	sourceB: TransitionSourceParams;
	mediaMap: Map<string, { url: string; file?: File }>;
}

export class TransitionNode extends BaseNode<TransitionNodeParams> {
	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const { transitionType, transitionDuration, cutTime } = this.params;
		const halfDuration = transitionDuration / 2;
		const transitionStart = cutTime - halfDuration;
		const transitionEnd = cutTime + halfDuration;

		if (time < transitionStart || time >= transitionEnd) return;

		const progress = (time - transitionStart) / transitionDuration;

		const canvasA = await this.renderSourceFrame({
			renderer,
			sourceParams: this.params.sourceA,
			time,
		});
		const canvasB = await this.renderSourceFrame({
			renderer,
			sourceParams: this.params.sourceB,
			time,
		});

		if (!canvasA || !canvasB) return;

		const definition = getTransition({ transitionType });

		const result = renderTransition({
			sourceA: canvasA,
			sourceB: canvasB,
			width: renderer.width,
			height: renderer.height,
			progress,
			fragmentShader: definition.fragmentShader,
		});

		renderer.context.save();
		renderer.context.globalCompositeOperation = "source-over";
		renderer.context.globalAlpha = 1;
		renderer.context.drawImage(result as CanvasImageSource, 0, 0);
		renderer.context.restore();
	}

	private buildContentNode({
		sourceParams,
	}: {
		sourceParams: TransitionSourceParams;
	}): BaseNode | null {
		if (!sourceParams.mediaId || !sourceParams.mediaType) return null;

		const media = this.params.mediaMap.get(sourceParams.mediaId);
		if (!media?.url) return null;

		const shared = {
			duration: sourceParams.duration,
			timeOffset: sourceParams.timeOffset,
			trimStart: sourceParams.trimStart,
			trimEnd: sourceParams.trimEnd,
			playbackRate: sourceParams.playbackRate,
			transform: sourceParams.transform,
			animations: sourceParams.animations,
			opacity: sourceParams.opacity,
			blendMode: sourceParams.blendMode,
			effects: sourceParams.effects,
		};

		if (sourceParams.mediaType === "video") {
			if (!media.file) return null;
			return new VideoNode({
				...shared,
				url: media.url,
				file: media.file,
				mediaId: sourceParams.mediaId,
			});
		}

		return new ImageNode({ ...shared, url: media.url });
	}

	// renders the source clip's frame (respecting transform/trim/effects) into
	// its own offscreen canvas so the transition shader has real pixels to blend
	private async renderSourceFrame({
		renderer,
		sourceParams,
		time,
	}: {
		renderer: CanvasRenderer;
		sourceParams: TransitionSourceParams;
		time: number;
	}): Promise<HTMLCanvasElement | OffscreenCanvas | null> {
		const offscreen = createOffscreenCanvas({
			width: renderer.width,
			height: renderer.height,
		});
		const ctx = offscreen.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return null;

		const contentNode = this.buildContentNode({ sourceParams });
		if (!contentNode) return offscreen;

		const originalContext = renderer.context;
		renderer.context = ctx;
		try {
			await contentNode.render({ renderer, time });
		} finally {
			renderer.context = originalContext;
		}

		return offscreen;
	}
}
