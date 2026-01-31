import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { videoCache } from "@/services/video-cache/service";

const VIDEO_EPSILON = 1 / 1000;

export interface BaseMediaNodeParams {
	file: File;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	opacity?: number;
}

export interface VideoNodeParams extends BaseMediaNodeParams {
	mediaId: string;
}

export class VideoNode extends BaseNode<VideoNodeParams> {
	private getVideoTime(time: number) {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	private isInRange(time: number) {
		const videoTime = this.getVideoTime(time);
		return (
			videoTime >= this.params.trimStart - VIDEO_EPSILON &&
			videoTime < this.params.trimStart + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		const videoTime = this.getVideoTime(time);
		const frame = await videoCache.getFrameAt({
			mediaId: this.params.mediaId,
			file: this.params.file,
			time: videoTime,
		});

		if (frame) {
			renderer.context.save();

			if (this.params.opacity !== undefined) {
				renderer.context.globalAlpha = this.params.opacity;
			}

			if (
				this.params.x !== undefined &&
				this.params.y !== undefined &&
				this.params.width !== undefined &&
				this.params.height !== undefined
			) {
				renderer.context.drawImage(
					frame.canvas,
					this.params.x,
					this.params.y,
					this.params.width,
					this.params.height,
				);
			} else {
				renderer.context.drawImage(
					frame.canvas,
					0,
					0,
					renderer.width,
					renderer.height,
				);
			}

			renderer.context.restore();
		}
	}
}
