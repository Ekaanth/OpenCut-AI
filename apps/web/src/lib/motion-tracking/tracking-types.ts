export interface TrackingPoint {
	x: number;
	y: number;
}

export interface TrackingFrame {
	time: number;
	point: TrackingPoint;
	confidence: number;
}

export interface MotionTrack {
	id: string;
	elementId: string;
	trackId: string;
	property: "transform.position.x" | "transform.position.y" | "transform.position";
	frames: TrackingFrame[];
	startTime: number;
	endTime: number;
}

export interface TrackingRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface TrackingOptions {
	searchRadius: number;
	sampleInterval: number;
	templateScale: number;
	minConfidence: number;
}

export const DEFAULT_TRACKING_OPTIONS: TrackingOptions = {
	searchRadius: 64,
	sampleInterval: 0.1,
	templateScale: 0.25,
	minConfidence: 0.5,
};

export function normalizedCrossCorrelation(
	template: Float32Array,
	search: Float32Array,
	templateWidth: number,
	templateHeight: number,
	searchWidth: number,
	offsetX: number,
	offsetY: number,
): number {
	const tw = templateWidth;
	const th = templateHeight;
	const n = tw * th;

	let sumT = 0;
	let sumS = 0;
	for (let i = 0; i < n; i++) {
		sumT += template[i];
		sumS += search[(offsetY + Math.floor(i / tw)) * searchWidth + offsetX + (i % tw)];
	}
	const meanT = sumT / n;
	const meanS = sumS / n;

	let num = 0;
	let denT = 0;
	let denS = 0;

	for (let j = 0; j < th; j++) {
		for (let i = 0; i < tw; i++) {
			const tVal = template[j * tw + i] - meanT;
			const sVal = search[(offsetY + j) * searchWidth + offsetX + i] - meanS;
			num += tVal * sVal;
			denT += tVal * tVal;
			denS += sVal * sVal;
		}
	}

	const den = Math.sqrt(denT * denS);
	if (den < 1e-10) return 0;
	return num / den;
}

export function extractGrayscalePatch(
	imageData: ImageData,
	region: TrackingRegion,
	targetWidth: number,
	targetHeight: number,
): Float32Array {
	const result = new Float32Array(targetWidth * targetHeight);
	const scaleX = region.width / targetWidth;
	const scaleY = region.height / targetHeight;

	for (let y = 0; y < targetHeight; y++) {
		for (let x = 0; x < targetWidth; x++) {
			const srcX = Math.floor(region.x + x * scaleX);
			const srcY = Math.floor(region.y + y * scaleY);

			if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
				const idx = (srcY * imageData.width + srcX) * 4;
				const r = imageData.data[idx];
				const g = imageData.data[idx + 1];
				const b = imageData.data[idx + 2];
				result[y * targetWidth + x] = 0.299 * r + 0.587 * g + 0.114 * b;
			}
		}
	}

	return result;
}

export function findBestMatch(
	template: Float32Array,
	searchImage: Float32Array,
	templateWidth: number,
	templateHeight: number,
	searchWidth: number,
	searchHeight: number,
	searchRadius: number,
): { offsetX: number; offsetY: number; confidence: number } {
	let bestScore = -Infinity;
	let bestX = 0;
	let bestY = 0;

	const maxOffX = Math.min(searchRadius, searchWidth - templateWidth);
	const maxOffY = Math.min(searchRadius, searchHeight - templateHeight);

	for (let dy = -maxOffY; dy <= maxOffY; dy += 2) {
		for (let dx = -maxOffX; dx <= maxOffX; dx += 2) {
			const ox = Math.floor(searchWidth / 2 - templateWidth / 2 + dx);
			const oy = Math.floor(searchHeight / 2 - templateHeight / 2 + dy);

			if (ox < 0 || oy < 0 || ox + templateWidth > searchWidth || oy + templateHeight > searchHeight) {
				continue;
			}

			const score = normalizedCrossCorrelation(
				template, searchImage, templateWidth, templateHeight, searchWidth, ox, oy,
			);

			if (score > bestScore) {
				bestScore = score;
				bestX = dx;
				bestY = dy;
			}
		}
	}

	return { offsetX: bestX, offsetY: bestY, confidence: bestScore };
}
