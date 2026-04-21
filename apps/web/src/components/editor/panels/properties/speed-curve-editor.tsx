"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { resolvePlaybackRateAtTime } from "@/lib/animation";
import { getNumberChannelForPath } from "@/lib/animation/number-channel";
import {
	upsertElementKeyframe,
	removeElementKeyframe,
} from "@/lib/animation/keyframes";
import type { AnimationPropertyPath } from "@/types/animation";
import type { VisualElement } from "@/types/timeline";

const PROPERTY_PATH: AnimationPropertyPath = "playbackRate";
const MIN_RATE = 0.1;
const MAX_RATE = 4.0;

const PRESET_CURVES = [
	{
		name: "Constant",
		points: [
			{ t: 0, v: 1.0 },
			{ t: 1, v: 1.0 },
		],
	},
	{
		name: "Ease In",
		points: [
			{ t: 0, v: 1.0 },
			{ t: 1, v: 3.0 },
		],
	},
	{
		name: "Ease Out",
		points: [
			{ t: 0, v: 3.0 },
			{ t: 1, v: 1.0 },
		],
	},
	{
		name: "Speed Up & Back",
		points: [
			{ t: 0, v: 1.0 },
			{ t: 0.5, v: 3.0 },
			{ t: 1, v: 1.0 },
		],
	},
	{
		name: "Slow Mo",
		points: [
			{ t: 0, v: 1.0 },
			{ t: 0.3, v: 0.25 },
			{ t: 0.7, v: 0.25 },
			{ t: 1, v: 1.0 },
		],
	},
];

interface SpeedCurveEditorProps {
	element: VisualElement;
	trackId: string;
}

export function SpeedCurveEditor({ element, trackId }: SpeedCurveEditorProps) {
	const editor = useEditor();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const duration = element.duration;
	const baseRate =
		element.type === "video" ? (element.playbackRate ?? 1.0) : 1.0;
	const animations = element.animations;
	const channel = animations
		? getNumberChannelForPath({ animations, propertyPath: PROPERTY_PATH })
		: null;
	const hasKeyframes = !!(channel && channel.keyframes.length > 0);

	const updateAnimations = useCallback(
		(newAnimations: ReturnType<typeof upsertElementKeyframe>) => {
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { animations: newAnimations },
					},
				],
			});
		},
		[editor, trackId, element.id],
	);

	const drawCurve = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const w = canvas.width;
		const h = canvas.height;
		const padding = 24;

		ctx.clearRect(0, 0, w, h);

		ctx.fillStyle = "hsl(var(--muted))";
		ctx.fillRect(0, 0, w, h);

		ctx.strokeStyle = "rgba(255,255,255,0.1)";
		ctx.lineWidth = 1;
		for (let r = MIN_RATE; r <= MAX_RATE; r += 0.5) {
			const y =
				padding + ((MAX_RATE - r) / (MAX_RATE - MIN_RATE)) * (h - padding * 2);
			ctx.beginPath();
			ctx.moveTo(padding, y);
			ctx.lineTo(w - padding, y);
			ctx.stroke();
		}

		const normalY =
			padding + ((MAX_RATE - 1.0) / (MAX_RATE - MIN_RATE)) * (h - padding * 2);
		ctx.strokeStyle = "rgba(255,255,255,0.25)";
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(padding, normalY);
		ctx.lineTo(w - padding, normalY);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.strokeStyle = "rgb(59, 130, 246)";
		ctx.lineWidth = 2;
		ctx.beginPath();

		const steps = Math.max(50, Math.floor(w - padding * 2));
		for (let i = 0; i <= steps; i++) {
			const fraction = i / steps;
			const localTime = fraction * duration;
			const rate = resolvePlaybackRateAtTime({
				basePlaybackRate: baseRate,
				animations,
				localTime,
			});
			const x = padding + fraction * (w - padding * 2);
			const y =
				padding +
				((MAX_RATE - Math.min(MAX_RATE, Math.max(MIN_RATE, rate))) /
					(MAX_RATE - MIN_RATE)) *
					(h - padding * 2);

			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		if (channel) {
			for (const kf of channel.keyframes) {
				const x = padding + (kf.time / duration) * (w - padding * 2);
				const y =
					padding +
					((MAX_RATE - (kf.value as number)) / (MAX_RATE - MIN_RATE)) *
						(h - padding * 2);

				ctx.fillStyle = "rgb(59, 130, 246)";
				ctx.beginPath();
				ctx.arc(x, y, 5, 0, Math.PI * 2);
				ctx.fill();

				ctx.fillStyle = "white";
				ctx.beginPath();
				ctx.arc(x, y, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.fillStyle = "rgba(255,255,255,0.5)";
		ctx.font = "9px monospace";
		ctx.textAlign = "left";
		ctx.fillText(`${MAX_RATE}x`, 2, padding + 4);
		ctx.fillText(`${MIN_RATE}x`, 2, h - padding + 10);
		ctx.fillText("1.0x", 2, normalY + 3);
	}, [duration, baseRate, animations, channel]);

	useEffect(() => {
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width } = entry.contentRect;
				const canvas = canvasRef.current;
				if (canvas) {
					canvas.width = width * 2;
					canvas.height = 120 * 2;
					canvas.style.width = `${width}px`;
					canvas.style.height = "120px";
					drawCurve();
				}
			}
		});

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => resizeObserver.disconnect();
	}, [drawCurve]);

	useEffect(() => {
		drawCurve();
	}, [drawCurve]);

	const handleCanvasClick = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			const px = (e.clientX - rect.left) * scaleX;
			const py = (e.clientY - rect.top) * scaleY;

			const padding = 24;
			const fraction = Math.max(
				0,
				Math.min(1, (px - padding) / (canvas.width - padding * 2)),
			);
			const rate = Math.max(
				MIN_RATE,
				Math.min(
					MAX_RATE,
					MAX_RATE -
						((py - padding) / (canvas.height - padding * 2)) *
							(MAX_RATE - MIN_RATE),
				),
			);

			const localTime = fraction * duration;

			const newAnimations = upsertElementKeyframe({
				animations,
				propertyPath: PROPERTY_PATH,
				time: localTime,
				value: Math.round(rate * 100) / 100,
				interpolation: "linear",
			});

			updateAnimations(newAnimations);
		},
		[animations, duration, updateAnimations],
	);

	const handleRemoveKeyframes = useCallback(() => {
		if (!channel) return;

		let currentAnimations = animations;
		for (const kf of channel.keyframes) {
			currentAnimations = removeElementKeyframe({
				animations: currentAnimations,
				propertyPath: PROPERTY_PATH,
				keyframeId: kf.id,
			});
		}

		updateAnimations(currentAnimations);
	}, [animations, channel, updateAnimations]);

	const applyPreset = useCallback(
		(preset: (typeof PRESET_CURVES)[number]) => {
			let currentAnimations = element.animations;

			const existingChannel = element.animations
				? getNumberChannelForPath({
						animations: element.animations,
						propertyPath: PROPERTY_PATH,
					})
				: null;
			if (existingChannel) {
				for (const kf of existingChannel.keyframes) {
					currentAnimations = removeElementKeyframe({
						animations: currentAnimations,
						propertyPath: PROPERTY_PATH,
						keyframeId: kf.id,
					});
				}
			}

			for (const point of preset.points) {
				currentAnimations = upsertElementKeyframe({
					animations: currentAnimations,
					propertyPath: PROPERTY_PATH,
					time: point.t * duration,
					value: point.v,
					interpolation: "linear",
				});
			}

			updateAnimations(currentAnimations);
		},
		[element, duration, updateAnimations],
	);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-medium text-muted-foreground">
					Speed Curve
				</span>
				{hasKeyframes && (
					<button
						type="button"
						onClick={handleRemoveKeyframes}
						className="text-[10px] text-muted-foreground hover:text-foreground"
					>
						Reset
					</button>
				)}
			</div>

			<div ref={containerRef} className="rounded-md overflow-hidden border">
				<canvas
					ref={canvasRef}
					onClick={handleCanvasClick}
					className={cn("cursor-crosshair w-full")}
				/>
			</div>

			<div className="flex gap-1 flex-wrap">
				{PRESET_CURVES.map((preset) => (
					<button
						key={preset.name}
						type="button"
						onClick={() => applyPreset(preset)}
						className="text-[10px] px-2 py-1 rounded border hover:bg-accent/50"
					>
						{preset.name}
					</button>
				))}
			</div>

			<p className="text-[10px] text-muted-foreground">
				Click on the curve to add speed keyframes. Presets apply common speed
				ramp patterns.
			</p>
		</div>
	);
}
