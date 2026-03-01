import { useEffect, useRef } from "react";
import { effectPreviewService } from "@/services/renderer/effect-preview";
import type { EffectParamValues } from "@/types/effects";

export function useEffectPreview({
	effectType,
	params,
	canvasRef,
	isActive,
}: {
	effectType: string;
	params: EffectParamValues;
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	isActive: boolean;
}): void {
	const requestRef = useRef<number>(0);

	useEffect(() => {
		if (!isActive) {
			if (requestRef.current) {
				cancelAnimationFrame(requestRef.current);
				requestRef.current = 0;
			}
			return;
		}

		const loop = (): void => {
			const canvas = canvasRef.current;
			if (canvas) {
				effectPreviewService.renderPreview({
					effectType,
					params,
					targetCanvas: canvas,
				});
			}
			requestRef.current = requestAnimationFrame(loop);
		};

		requestRef.current = requestAnimationFrame(loop);

		return () => {
			if (requestRef.current) {
				cancelAnimationFrame(requestRef.current);
			}
		};
	}, [effectType, params, canvasRef, isActive]);
}
