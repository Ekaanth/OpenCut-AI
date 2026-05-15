export function computeHistogram(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
): Float32Array {
	const imageData = ctx.getImageData(x, y, width, height);
	const data = imageData.data;
	const bins = 8;
	const histogram = new Float32Array(bins * 3);
	const total = data.length / 4;

	for (let i = 0; i < data.length; i += 4) {
		const r = Math.floor((data[i] / 256) * bins);
		const g = Math.floor((data[i + 1] / 256) * bins);
		const b = Math.floor((data[i + 2] / 256) * bins);
		histogram[r]++;
		histogram[bins + g]++;
		histogram[bins * 2 + b]++;
	}

	for (let i = 0; i < histogram.length; i++) {
		histogram[i] /= total;
	}

	return histogram;
}

export function chiSquaredDistance(a: Float32Array, b: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const denom = a[i] + b[i];
		if (denom > 0) {
			sum += (a[i] - b[i]) ** 2 / denom;
		}
	}
	return sum * 0.5;
}

export function averageColorDistance(
	ctx: CanvasRenderingContext2D,
	ctx2: CanvasRenderingContext2D,
	width: number,
	height: number,
): number {
	const step = 4;
	let totalDiff = 0;
	let count = 0;

	const d1 = ctx.getImageData(0, 0, width, height).data;
	const d2 = ctx2.getImageData(0, 0, width, height).data;

	for (let i = 0; i < d1.length; i += 4 * step) {
		const dr = d1[i] - d2[i];
		const dg = d1[i + 1] - d2[i + 1];
		const db = d1[i + 2] - d2[i + 2];
		totalDiff += Math.sqrt((dr * dr + dg * dg + db * db) / 3) / 255;
		count++;
	}

	return count > 0 ? totalDiff / count : 0;
}
