"use client";

import { useCallback, useMemo, useRef } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/hooks/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { getLastFrameTime } from "@/lib/time";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";

function usePreviewSize() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	return {
		width: activeProject?.settings.canvasSize.width,
		height: activeProject?.settings.canvasSize.height,
	};
}

function RenderTreeController() {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const mediaAssets = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const { width, height } = usePreviewSize();

	useDeepCompareEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [tracks, mediaAssets, activeProject?.settings.background, width, height]);

	return null;
}

export function PreviewPanel() {
	return (
		<div className="bg-panel relative flex h-full min-h-0 w-full min-w-0 flex-col rounded-sm">
			<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
				<PreviewCanvas />
				<RenderTreeController />
			</div>
		</div>
	);
}

function PreviewCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const { width, height } = usePreviewSize();
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width,
			height,
			fps: activeProject.settings.fps,
		});
	}, [width, height, activeProject.settings.fps]);

	const renderTree = editor.renderer.getRenderTree();

	const render = useCallback(() => {
		if (canvasRef.current && renderTree && !renderingRef.current) {
			const time = editor.playback.getCurrentTime();
			const lastFrameTime = getLastFrameTime({
				duration: renderTree.duration,
				fps: renderer.fps,
			});
			const renderTime = Math.min(time, lastFrameTime);
			const frame = Math.floor(renderTime * renderer.fps);

			if (
				frame !== lastFrameRef.current ||
				renderTree !== lastSceneRef.current
			) {
				renderingRef.current = true;
				lastSceneRef.current = renderTree;
				lastFrameRef.current = frame;
				renderer
					.renderToCanvas({
						node: renderTree,
						time: renderTime,
						targetCanvas: canvasRef.current,
					})
					.then(() => {
						renderingRef.current = false;
					});
			}
		}
	}, [renderer, renderTree, editor.playback]);

	useRafLoop(render);

	return (
		<div className="relative">
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				className="block max-h-full max-w-full border"
				style={{
					background:
						activeProject.settings.background.type === "blur"
							? "transparent"
							: activeProject?.settings.background.color,
				}}
			/>
			<PreviewInteractionOverlay canvasRef={canvasRef} />
		</div>
	);
}
