import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";

export type WatermarkNodeParams = {
	canvasWidth: number;
	canvasHeight: number;
	text?: string;
};

/**
 * Scale watermark proportionally to canvas size.
 * Reference: 1080p canvas. On a 4K canvas, everything is 2x larger.
 */
function scale(value: number, canvasHeight: number): number {
	return value * (canvasHeight / 1080);
}

export class WatermarkNode extends BaseNode<WatermarkNodeParams> {
	async render({
		renderer,
		time: _time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}) {
		const ctx = renderer.context;
		const { canvasWidth, canvasHeight, text = "Made with OpenCut AI" } =
			this.params;

		const s = (v: number) => scale(v, canvasHeight);

		const padding = s(20);
		const fontSize = s(14);
		const logoSize = s(16);
		const gap = s(7);
		const bgPadX = s(12);
		const bgPadY = s(6);
		const bgRadius = s(8);
		const opacity = 0.5;

		ctx.save();
		ctx.globalAlpha = opacity;

		// Measure text
		ctx.font = `600 ${fontSize}px sans-serif`;
		ctx.textBaseline = "middle";
		const textWidth = ctx.measureText(text).width;

		// Badge dimensions
		const badgeW = logoSize + gap + textWidth + bgPadX * 2;
		const badgeH = Math.max(logoSize, fontSize) + bgPadY * 2;

		// Bottom-right position
		const bx = canvasWidth - badgeW - padding;
		const by = canvasHeight - badgeH - padding;

		// Background pill
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.beginPath();
		if (typeof ctx.roundRect === "function") {
			ctx.roundRect(bx, by, badgeW, badgeH, bgRadius);
		} else {
			// Fallback for environments without roundRect
			ctx.rect(bx, by, badgeW, badgeH);
		}
		ctx.fill();

		// --- Logo ---
		const lx = bx + bgPadX;
		const ly = by + (badgeH - logoSize) / 2;

		// Rounded square outline
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = s(1.5);
		ctx.beginPath();
		if (typeof ctx.roundRect === "function") {
			ctx.roundRect(lx, ly, logoSize, logoSize, s(3));
		} else {
			ctx.rect(lx, ly, logoSize, logoSize);
		}
		ctx.stroke();

		// Play triangle
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		const tx = lx + logoSize * 0.38;
		const ty = ly + logoSize * 0.25;
		const tw = logoSize * 0.38;
		const th = logoSize * 0.5;
		ctx.moveTo(tx, ty);
		ctx.lineTo(tx + tw, ty + th / 2);
		ctx.lineTo(tx, ty + th);
		ctx.closePath();
		ctx.fill();

		// AI dot
		ctx.fillStyle = "#3b82f6";
		ctx.beginPath();
		ctx.arc(lx + logoSize - s(1), ly + s(2.5), s(3), 0, Math.PI * 2);
		ctx.fill();

		// --- Text ---
		ctx.fillStyle = "#ffffff";
		ctx.font = `600 ${fontSize}px sans-serif`;
		ctx.textBaseline = "middle";
		ctx.fillText(text, lx + logoSize + gap, by + badgeH / 2 + s(0.5));

		ctx.restore();
	}
}
