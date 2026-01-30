import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode, type BaseNodeParams } from "./base-node";
import type { Transform } from "@/types/timeline";

const STICKER_EPSILON = 1 / 1000;

export type StickerNodeParams = BaseNodeParams & {
	iconName: string;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	color?: string;
};

export class StickerNode extends BaseNode<StickerNodeParams> {
	private image?: HTMLImageElement;
	private readyPromise: Promise<void>;

	constructor(params: StickerNodeParams) {
		super(params);
		this.readyPromise = this.load();
	}

	private async load() {
		const image = new Image();
		this.image = image;
		const color = this.params.color
			? `&color=${encodeURIComponent(this.params.color)}`
			: "";
		const url = `https://api.iconify.design/${this.params.iconName}.svg?width=200&height=200${color}`;

		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () =>
				reject(new Error(`Failed to load sticker: ${this.params.iconName}`));
			image.src = url;
		});
	}

	private getStickerTime(time: number) {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	private isInRange(time: number) {
		const stickerTime = this.getStickerTime(time);
		return (
			stickerTime >= this.params.trimStart - STICKER_EPSILON &&
			stickerTime < this.params.trimStart + this.params.duration
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

		const { transform, opacity } = this.params;
		const size = 200 * transform.scale;
		const x = renderer.width / 2 + transform.position.x - size / 2;
		const y = renderer.height / 2 + transform.position.y - size / 2;

		renderer.context.save();
		renderer.context.globalAlpha = opacity;

		if (transform.rotate !== 0) {
			const centerX = x + size / 2;
			const centerY = y + size / 2;
			renderer.context.translate(centerX, centerY);
			renderer.context.rotate((transform.rotate * Math.PI) / 180);
			renderer.context.translate(-centerX, -centerY);
		}

		renderer.context.drawImage(this.image, x, y, size, size);
		renderer.context.restore();
	}
}
