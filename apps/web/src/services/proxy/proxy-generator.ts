import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	Output,
	Mp4OutputFormat,
	BufferTarget,
	CanvasSource,
	QUALITY_LOW,
} from "mediabunny";
import type { ProxyResolution } from "@/services/storage/types";
import { PROXY_PRESETS } from "@/services/storage/types";

export interface ProxyGenerateOptions {
	file: File;
	resolution: ProxyResolution;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
}

export interface ProxyGenerateResult {
	file: File;
	width: number;
	height: number;
}

export async function generateProxy(
	options: ProxyGenerateOptions,
): Promise<ProxyGenerateResult> {
	const { file, resolution, onProgress, signal } = options;
	const preset = PROXY_PRESETS[resolution];

	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});

	try {
		const videoTrack = await input.getPrimaryVideoTrack();
		if (!videoTrack) throw new Error("No video track found");

		const canDecode = await videoTrack.canDecode();
		if (!canDecode) throw new Error("Video codec not supported for decoding");

		const origWidth = videoTrack.displayWidth;
		const origHeight = videoTrack.displayHeight;
		const duration = videoTrack.duration;

		if (duration <= 0) throw new Error("Video has no duration");

		const scale = Math.min(
			preset.maxWidth / origWidth,
			preset.maxHeight / origHeight,
			1,
		);
		const proxyWidth = Math.round(origWidth * scale);
		const proxyHeight = Math.round(origHeight * scale);

		const fps = Math.min(videoTrack.fps ?? 30, 30);
		const frameCount = Math.ceil(duration * fps);

		const canvas = document.createElement("canvas");
		canvas.width = proxyWidth;
		canvas.height = proxyHeight;

		const sink = new CanvasSink(videoTrack, {
			poolSize: 2,
			fit: "contain",
		});

		const output = new Output({
			format: new Mp4OutputFormat(),
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(canvas, {
			codec: "avc",
			bitrate: QUALITY_LOW,
		});

		output.addVideoTrack(videoSource, { frameRate: fps });
		await output.start();

		const iterator = sink.canvases(0);
		let framesProcessed = 0;

		try {
			for await (const frame of iterator) {
				if (signal?.aborted) {
					await output.cancel();
					throw new Error("Proxy generation cancelled");
				}

				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.clearRect(0, 0, proxyWidth, proxyHeight);
					frame.draw(ctx, 0, 0, proxyWidth, proxyHeight);
				}

				await videoSource.add(frame.timestamp, frame.duration);

				framesProcessed++;
				if (onProgress && framesProcessed % 5 === 0) {
					onProgress(Math.min(framesProcessed / frameCount, 0.99));
				}

				if (frame.timestamp >= duration - frame.duration) break;
			}
		} finally {
			try {
				await iterator.return();
			} catch {}
		}

		videoSource.close();
		await output.finalize();

		const buffer = output.target.buffer;
		if (!buffer) throw new Error("Failed to generate proxy");

		const proxyFile = new File([buffer], `proxy_${file.name}`, {
			type: "video/mp4",
		});

		onProgress?.(1);

		return { file: proxyFile, width: proxyWidth, height: proxyHeight };
	} finally {
		input.dispose();
	}
}
