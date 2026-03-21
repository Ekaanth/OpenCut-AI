import type { BaseNode } from "./nodes/base-node";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: number;
	watermark?: boolean;
};

// Pre-loaded watermark logo (loaded once, reused across frames)
let watermarkLogo: ImageBitmap | HTMLImageElement | null = null;
let watermarkLogoLoading: Promise<void> | null = null;

async function ensureWatermarkLogo(): Promise<void> {
	if (watermarkLogo) return;
	if (watermarkLogoLoading) {
		await watermarkLogoLoading;
		return;
	}

	watermarkLogoLoading = (async () => {
		try {
			const response = await fetch("/favicon.png");
			const blob = await response.blob();
			if (typeof createImageBitmap === "function") {
				watermarkLogo = await createImageBitmap(blob);
			} else {
				// Fallback for environments without createImageBitmap
				const img = new Image();
				const url = URL.createObjectURL(blob);
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = reject;
					img.src = url;
				});
				watermarkLogo = img;
			}
		} catch (err) {
			console.warn("Failed to load watermark logo:", err);
			watermarkLogo = null;
		}
	})();

	await watermarkLogoLoading;
}

export class CanvasRenderer {
	canvas: OffscreenCanvas | HTMLCanvasElement;
	context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
	width: number;
	height: number;
	fps: number;
	private watermark: boolean;

	constructor({ width, height, fps, watermark = false }: CanvasRendererParams) {
		this.width = width;
		this.height = height;
		this.fps = fps;
		this.watermark = watermark;

		try {
			this.canvas = new OffscreenCanvas(width, height);
		} catch {
			this.canvas = document.createElement("canvas");
			this.canvas.width = width;
			this.canvas.height = height;
		}

		const context = this.canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}

		this.context = context as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;

		// Start loading the watermark logo immediately if needed
		if (watermark) {
			ensureWatermarkLogo();
		}
	}

	setSize({ width, height }: { width: number; height: number }) {
		this.width = width;
		this.height = height;

		if (this.canvas instanceof OffscreenCanvas) {
			this.canvas = new OffscreenCanvas(width, height);
		} else {
			this.canvas.width = width;
			this.canvas.height = height;
		}

		const context = this.canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}
		this.context = context as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;
	}

	private clear() {
		this.context.fillStyle = "black";
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	async render({ node, time }: { node: BaseNode; time: number }) {
		this.clear();
		await node.render({ renderer: this, time });

		if (this.watermark) {
			await ensureWatermarkLogo();
			this.drawWatermark();
		}
	}

	async renderToCanvas({
		node,
		time,
		targetCanvas,
	}: {
		node: BaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
	}) {
		await this.render({ node, time });

		const ctx = targetCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get target canvas context");
		}

		ctx.drawImage(this.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
	}

	private drawWatermark() {
		const ctx = this.context;
		const cw = this.width;
		const ch = this.height;

		// Scale relative to 1080p
		const sf = Math.max(ch / 1080, 0.5);

		const text = "Made with OpenCut AI";
		const logoSz = Math.round(48 * sf);
		const fontSize = Math.round(32 * sf);
		const pad = Math.round(18 * sf);
		const gap = Math.round(14 * sf);
		const margin = Math.round(28 * sf);

		ctx.save();

		// Measure text
		ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
		ctx.textBaseline = "middle";
		const textW = ctx.measureText(text).width;

		const totalW = pad + logoSz + gap + textW + pad;
		const totalH = Math.round(Math.max(logoSz, fontSize) + pad * 2);

		const bx = cw - totalW - margin;
		const by = ch - totalH - margin;

		// --- Background pill ---
		ctx.globalAlpha = 0.65;
		ctx.fillStyle = "#000000";
		ctx.beginPath();
		const r = Math.round(totalH / 2);
		// Manual rounded rect for maximum compatibility
		ctx.moveTo(bx + r, by);
		ctx.lineTo(bx + totalW - r, by);
		ctx.arcTo(bx + totalW, by, bx + totalW, by + r, r);
		ctx.arcTo(bx + totalW, by + totalH, bx + totalW - r, by + totalH, r);
		ctx.lineTo(bx + r, by + totalH);
		ctx.arcTo(bx, by + totalH, bx, by + totalH - r, r);
		ctx.arcTo(bx, by, bx + r, by, r);
		ctx.closePath();
		ctx.fill();

		// --- Logo image ---
		ctx.globalAlpha = 1;
		const lx = bx + pad;
		const ly = by + (totalH - logoSz) / 2;

		if (watermarkLogo) {
			ctx.drawImage(watermarkLogo, lx, ly, logoSz, logoSz);
		} else {
			// Fallback: draw a simple white square + triangle if logo failed to load
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = Math.max(1, 1.5 * sf);
			ctx.strokeRect(lx, ly, logoSz, logoSz);
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.moveTo(lx + logoSz * 0.35, ly + logoSz * 0.2);
			ctx.lineTo(lx + logoSz * 0.75, ly + logoSz * 0.5);
			ctx.lineTo(lx + logoSz * 0.35, ly + logoSz * 0.8);
			ctx.closePath();
			ctx.fill();
		}

		// --- Text ---
		ctx.globalAlpha = 0.95;
		ctx.fillStyle = "#ffffff";
		ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
		ctx.textBaseline = "middle";
		ctx.fillText(text, lx + logoSz + gap, by + totalH / 2);

		ctx.restore();
	}
}
