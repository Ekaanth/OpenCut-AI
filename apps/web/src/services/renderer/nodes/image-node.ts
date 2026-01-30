import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { BaseMediaNodeParams } from "./video-node";

const IMAGE_EPSILON = 1 / 1000;

export type ImageNodeParams = BaseMediaNodeParams;

export class ImageNode extends BaseNode<ImageNodeParams> {
	private image?: HTMLImageElement;
	private readyPromise: Promise<void>;

	constructor(params: ImageNodeParams) {
		super(params);
		this.readyPromise = this.load();
	}

	private async load() {
		const image = new Image();
		this.image = image;
		const url = URL.createObjectURL(this.params.file);

		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Image load failed"));
			image.src = url;
		});

		URL.revokeObjectURL(url);
	}

	private getImageTime(time: number) {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	private isInRange(time: number) {
		const imageTime = this.getImageTime(time);
		return (
			imageTime >= this.params.trimStart - IMAGE_EPSILON &&
			imageTime < this.params.trimStart + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		await this.readyPromise;

		if (!this.image) {
			return;
		}

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
				this.image,
				this.params.x,
				this.params.y,
				this.params.width,
				this.params.height,
			);
		} else {
			const mediaW = this.image.naturalWidth || renderer.width;
			const mediaH = this.image.naturalHeight || renderer.height;
			const containScale = Math.min(
				renderer.width / mediaW,
				renderer.height / mediaH,
			);
			const drawW = mediaW * containScale;
			const drawH = mediaH * containScale;
			const drawX = (renderer.width - drawW) / 2;
			const drawY = (renderer.height - drawH) / 2;

			renderer.context.drawImage(this.image, drawX, drawY, drawW, drawH);
		}

		renderer.context.restore();
	}
}
