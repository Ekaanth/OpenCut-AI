import type { EditorCore } from "@/core";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { buildScene } from "@/services/renderer/scene-builder";

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

/**
 * Generate a small preview thumbnail of the current editor state.
 * Returns a base64 data URL (JPEG for smaller size) or null on failure.
 */
export async function generateCommitThumbnail(
	editor: EditorCore,
): Promise<string | null> {
	try {
		const project = editor.project.getActiveOrNull();
		if (!project) return null;

		const tracks = editor.timeline.getTracks();
		const mediaAssets = editor.media.getAssets();
		const duration = editor.timeline.getTotalDuration();

		if (duration === 0) return null;

		const { canvasSize, background } = project.settings;

		const scene = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize,
			background,
		});

		// Render at full resolution first
		const renderer = new CanvasRenderer({
			width: canvasSize.width,
			height: canvasSize.height,
			fps: project.settings.fps,
		});

		const fullCanvas = document.createElement("canvas");
		fullCanvas.width = canvasSize.width;
		fullCanvas.height = canvasSize.height;

		const currentTime = editor.playback.getCurrentTime();
		await renderer.renderToCanvas({
			node: scene,
			time: currentTime,
			targetCanvas: fullCanvas,
		});

		// Scale down to thumbnail size
		const thumbCanvas = document.createElement("canvas");
		thumbCanvas.width = THUMBNAIL_WIDTH;
		thumbCanvas.height = THUMBNAIL_HEIGHT;
		const ctx = thumbCanvas.getContext("2d");
		if (!ctx) return null;

		// Calculate aspect-fit scaling
		const sourceAspect = canvasSize.width / canvasSize.height;
		const thumbAspect = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;

		let sx = 0,
			sy = 0,
			sw = canvasSize.width,
			sh = canvasSize.height;

		if (sourceAspect > thumbAspect) {
			// Source is wider — crop sides
			sw = canvasSize.height * thumbAspect;
			sx = (canvasSize.width - sw) / 2;
		} else {
			// Source is taller — crop top/bottom
			sh = canvasSize.width / thumbAspect;
			sy = (canvasSize.height - sh) / 2;
		}

		ctx.drawImage(
			fullCanvas,
			sx,
			sy,
			sw,
			sh,
			0,
			0,
			THUMBNAIL_WIDTH,
			THUMBNAIL_HEIGHT,
		);

		// Use JPEG for smaller data URLs (~5-15 KB vs ~20-50 KB PNG)
		return thumbCanvas.toDataURL("image/jpeg", 0.7);
	} catch (error) {
		console.warn("Failed to generate commit thumbnail:", error);
		return null;
	}
}
