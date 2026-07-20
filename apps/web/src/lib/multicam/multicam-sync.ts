/**
 * Client-side multicam sync via audio cross-correlation.
 *
 * Aligns multiple camera angles to a chosen reference angle by matching their
 * audio waveforms — the same idea as PluralEyes. Works for cameras that were
 * NOT timecode-synced (the common case). Entirely on-device: we decode each
 * angle's audio with the Web Audio API (same pattern as `use-beat-detection`)
 * and correlate the resulting PCM arrays in JS.
 *
 * Algorithm:
 *   1. For each angle: find its media file, decode to mono PCM Float32Array.
 *   2. Downsample to ~8 kHz (sync doesn't need full bandwidth; this keeps
 *      correlation cheap).
 *   3. Cross-correlate each angle against the reference within a capped search
 *      window (±N seconds) and pick the lag with maximum correlation.
 *   4. Convert the winning lag to seconds. The caller shifts each angle's
 *      clips by that offset via `editor.timeline.updateElements`.
 *
 * Complexity is O(reference_samples × window_samples) per angle, NOT O(n²) —
 * the window cap is what keeps long recordings tractable.
 */

import type { TimelineTrack } from "@/types/timeline";

/** Minimal editor surface this module needs (just media lookup). */
export interface MediaBackedEditor {
	media: {
		getAssets(): Array<{ id: string; file?: File; url?: string }>;
	};
}

export interface AngleAudio {
	trackId: string;
	/** Mono PCM at the decode sample rate, or null if undecodable. */
	samples: Float32Array | null;
	sampleRate: number;
	/** Human-readable reason when `samples` is null. */
	error?: string;
}

export interface SyncOffset {
	trackId: string;
	/** Seconds to ADD to this angle's clip startTimes to align it. */
	offsetSeconds: number;
	/** Normalized cross-correlation score in [-1, 1]; higher = more confident. */
	score: number;
	/** Skipped (no decodable audio). */
	skipped?: boolean;
	reason?: string;
}

export interface SyncResult {
	referenceTrackId: string;
	sampleRate: number;
	offsets: SyncOffset[];
}

/** Target sample rate after downsampling. Sync doesn't need full bandwidth. */
const TARGET_SR = 8000;
/** Default correlation search window (each side of zero lag), in seconds. */
export const DEFAULT_SEARCH_WINDOW_SEC = 60;
/** Hard cap on source duration to keep correlation tractable on the main thread. */
const MAX_SOURCE_SEC = 60 * 60; // 1 hour

/**
 * Find and decode the first media-backed element on a track to mono PCM.
 * Returns null (with a reason) if the track has no usable audio file.
 */
export async function decodeTrackAudio(
	track: TimelineTrack,
	editor: MediaBackedEditor,
): Promise<AngleAudio> {
	const mediaEl = track.elements.find(
		(e) => "mediaId" in e && typeof e.mediaId === "string",
	) as { mediaId?: string } | undefined;
	const mediaId = mediaEl?.mediaId;
	if (!mediaId) {
		return { trackId: track.id, samples: null, sampleRate: 0, error: "no media on track" };
	}
	const asset = editor.media.getAssets().find((a) => a.id === mediaId);
	const file = asset?.file;
	if (!file) {
		return { trackId: track.id, samples: null, sampleRate: 0, error: "asset file missing" };
	}

	let ctx: AudioContext | null = null;
	try {
		const ab = await file.arrayBuffer();
		// Decode at a modest rate to bound work; AudioContext resamples for us.
		ctx = new AudioContext({ sampleRate: 22050 });
		const audioBuffer = await ctx.decodeAudioData(ab);
		const channelCount = audioBuffer.numberOfChannels;
		// Mix down to mono by averaging channels.
		const len = audioBuffer.length;
		const mono = new Float32Array(len);
		for (let ch = 0; ch < channelCount; ch++) {
			const data = audioBuffer.getChannelData(ch);
			for (let i = 0; i < len; i++) mono[i] += data[i];
		}
		if (channelCount > 1) {
			const inv = 1 / channelCount;
			for (let i = 0; i < len; i++) mono[i] *= inv;
		}
		return { trackId: track.id, samples: mono, sampleRate: audioBuffer.sampleRate };
	} catch (err) {
		return {
			trackId: track.id,
			samples: null,
			sampleRate: 0,
			error: err instanceof Error ? err.message : "decode failed",
		};
	} finally {
		ctx?.close().catch(() => undefined);
	}
}

/** Decimate `input` by averaging every `factor` samples (simple low-pass + downsample). */
export function downsample(input: Float32Array, factor: number): Float32Array {
	if (factor <= 1) return input;
	const outLen = Math.floor(input.length / factor);
	const out = new Float32Array(outLen);
	for (let i = 0; i < outLen; i++) {
		let sum = 0;
		const base = i * factor;
		for (let j = 0; j < factor; j++) sum += input[base + j] ?? 0;
		out[i] = sum / factor;
	}
	return out;
}

/**
 * Cross-correlate `other` against `reference` within ±maxLag samples and
 * return the lag with the highest normalized correlation.
 *
 * Convention: a returned lag of +L means `other` should be shifted L samples
 * LATER to align with `reference` (i.e. `other` is L samples "ahead").
 */
export function crossCorrelate(
	reference: Float32Array,
	other: Float32Array,
	maxLag: number,
): { lag: number; score: number } {
	const refLen = reference.length;
	const otherLen = other.length;
	if (refLen === 0 || otherLen === 0) return { lag: 0, score: 0 };

	// Precompute energies for normalization.
	let refEnergy = 0;
	for (let i = 0; i < refLen; i++) refEnergy += reference[i] * reference[i];
	if (refEnergy === 0) return { lag: 0, score: 0 };

	let bestLag = 0;
	let bestScore = -Infinity;

	for (let lag = -maxLag; lag <= maxLag; lag++) {
		let dot = 0;
		let otherEnergy = 0;
		// Overlap region: reference[i] with other[i - lag].
		const start = Math.max(0, lag);
		const end = Math.min(refLen, otherLen + lag);
		for (let i = start; i < end; i++) {
			const o = other[i - lag];
			dot += reference[i] * o;
			otherEnergy += o * o;
		}
		if (otherEnergy === 0) continue;
		const score = dot / Math.sqrt(refEnergy * otherEnergy);
		if (score > bestScore) {
			bestScore = score;
			bestLag = lag;
		}
	}
	return { lag: bestLag, score: bestScore === -Infinity ? 0 : bestScore };
}

/**
 * Compute sync offsets for all angles relative to a reference.
 *
 * Does NOT mutate the timeline — the caller decides whether/when to apply.
 */
export async function syncAngles(
	tracks: TimelineTrack[],
	referenceTrackId: string,
	editor: MediaBackedEditor,
	opts?: { searchWindowSec?: number; onProgress?: (msg: string) => void },
): Promise<SyncResult> {
	const searchWindowSec = opts?.searchWindowSec ?? DEFAULT_SEARCH_WINDOW_SEC;
	const onProgress = opts?.onProgress;

	const videoTracks = tracks.filter((t) => t.type === "video");
	if (videoTracks.length < 2) {
		throw new Error("Need at least 2 video tracks to sync.");
	}
	const refTrack = videoTracks.find((t) => t.id === referenceTrackId) ?? videoTracks[0];
	const refTrackId = refTrack.id;

	onProgress?.(`Decoding reference angle (${refTrack.name ?? "camera"})…`);
	const refAudio = await decodeTrackAudio(refTrack, editor);
	if (!refAudio.samples) {
		throw new Error(
			`Reference angle has no decodable audio (${refAudio.error ?? "unknown error"}). Pick a track with audio.`,
		);
	}
	if (refAudio.samples.length / refAudio.sampleRate > MAX_SOURCE_SEC) {
		throw new Error(
			`Reference angle is longer than ${MAX_SOURCE_SEC / 60} minutes; sync is capped for UI responsiveness.`,
		);
	}

	// Downsample reference to target rate once.
	const refFactor = Math.max(1, Math.round(refAudio.sampleRate / TARGET_SR));
	const refDs = downsample(refAudio.samples, refFactor);
	const refSr = refAudio.sampleRate / refFactor;
	const maxLag = Math.floor(searchWindowSec * refSr);

	const offsets: SyncOffset[] = [];
	for (const track of videoTracks) {
		if (track.id === refTrackId) {
			offsets.push({ trackId: track.id, offsetSeconds: 0, score: 1 });
			continue;
		}
		onProgress?.(`Decoding ${track.name ?? "angle"}…`);
		const angleAudio = await decodeTrackAudio(track, editor);
		if (!angleAudio.samples) {
			offsets.push({
				trackId: track.id,
				offsetSeconds: 0,
				score: 0,
				skipped: true,
				reason: angleAudio.error,
			});
			continue;
		}
		const factor = Math.max(1, Math.round(angleAudio.sampleRate / TARGET_SR));
		const otherDs = downsample(angleAudio.samples, factor);
		const { lag, score } = crossCorrelate(refDs, otherDs, maxLag);
		// lag is in downsampled samples; convert back to seconds.
		const offsetSeconds = lag / refSr;
		offsets.push({ trackId: track.id, offsetSeconds, score });
	}

	return { referenceTrackId: refTrackId, sampleRate: refSr, offsets };
}
