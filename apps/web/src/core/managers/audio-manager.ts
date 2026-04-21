import type { EditorCore } from "@/core";
import type { AudioClipSource } from "@/lib/media/audio";
import { createAudioContext, collectAudioClips } from "@/lib/media/audio";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private masterAnalyser: AnalyserNode | null = null;
	private trackNodes = new Map<
		string,
		{
			gain: GainNode;
			panner: StereoPannerNode;
			analyser: AnalyserNode;
		}
	>();
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private lookaheadSeconds = 2;
	private scheduleIntervalMs = 500;
	private clips: AudioClipSource[] = [];
	private sinks = new Map<string, AudioBufferSink>();
	private inputs = new Map<string, Input>();
	private activeClipIds = new Set<string>();
	private clipIterators = new Map<
		string,
		AsyncGenerator<WrappedAudioBuffer, void, unknown>
	>();
	private queuedSources = new Set<AudioBufferSourceNode>();
	private playbackSessionId = 0;
	private lastIsPlaying = false;
	private lastVolume = 1;
	private playbackLatencyCompensationSeconds = 0;
	private unsubscribers: Array<() => void> = [];

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
		);
		if (typeof window !== "undefined") {
			window.addEventListener("playback-seek", this.handleSeek);
		}
	}

	dispose(): void {
		this.stopPlayback();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		if (typeof window !== "undefined") {
			window.removeEventListener("playback-seek", this.handleSeek);
		}
		this.disposeSinks();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
			this.masterGain = null;
		}
	}

	private handlePlaybackChange = (): void => {
		const isPlaying = this.editor.playback.getIsPlaying();
		const volume = this.editor.playback.getVolume();

		if (volume !== this.lastVolume) {
			this.lastVolume = volume;
			this.updateGain();
		}

		if (isPlaying !== this.lastIsPlaying) {
			this.lastIsPlaying = isPlaying;
			if (isPlaying) {
				void this.startPlayback({
					time: this.editor.playback.getCurrentTime(),
				});
			} else {
				this.stopPlayback();
			}
		}
	};

	private handleSeek = (event: Event): void => {
		const detail = (event as CustomEvent<{ time: number }>).detail;
		if (!detail) return;

		if (this.editor.playback.getIsScrubbing()) {
			this.stopPlayback();
			return;
		}

		if (this.editor.playback.getIsPlaying()) {
			void this.startPlayback({ time: detail.time });
			return;
		}

		this.stopPlayback();
	};

	private handleTimelineChange = (): void => {
		this.disposeSinks();

		if (!this.editor.playback.getIsPlaying()) return;

		void this.startPlayback({ time: this.editor.playback.getCurrentTime() });
	};

	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof window === "undefined") return null;

		this.audioContext = createAudioContext();
		this.masterGain = this.audioContext.createGain();
		this.masterGain.gain.value = this.lastVolume;
		this.masterAnalyser = this.audioContext.createAnalyser();
		this.masterAnalyser.fftSize = 256;
		this.masterAnalyser.smoothingTimeConstant = 0.8;
		this.masterGain.connect(this.masterAnalyser);
		this.masterAnalyser.connect(this.audioContext.destination);
		return this.audioContext;
	}

	private updateGain(): void {
		if (!this.masterGain) return;
		this.masterGain.gain.value = this.lastVolume;
	}

	private getOrCreateTrackNodes(trackId: string): {
		gain: GainNode;
		panner: StereoPannerNode;
		analyser: AnalyserNode;
	} | null {
		const ctx = this.audioContext;
		if (!ctx || !this.masterGain) return null;

		const existing = this.trackNodes.get(trackId);
		if (existing) return existing;

		const tracks = this.editor.timeline.getTracks();
		const track = tracks.find((t) => t.id === trackId);
		const trackVolume =
			track && ("volume" in track ? track.volume : undefined) ?? 1;
		const trackPan =
			track && ("pan" in track ? track.pan : undefined) ?? 0;

		const gain = ctx.createGain();
		gain.gain.value = trackVolume;

		const panner = ctx.createStereoPanner();
		panner.pan.value = trackPan;

		const analyser = ctx.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.8;

		gain.connect(panner);
		panner.connect(analyser);
		analyser.connect(this.masterGain);

		const nodes = { gain, panner, analyser };
		this.trackNodes.set(trackId, nodes);
		return nodes;
	}

	private rebuildTrackNodes(): void {
		for (const [, nodes] of this.trackNodes) {
			try {
				nodes.gain.disconnect();
				nodes.panner.disconnect();
				nodes.analyser.disconnect();
			} catch {}
		}
		this.trackNodes.clear();
	}

	getTrackLevels(trackId: string): { peak: number; rms: number } {
		const nodes = this.trackNodes.get(trackId);
		if (!nodes) return { peak: 0, rms: 0 };
		return this.readAnalyserLevels(nodes.analyser);
	}

	getMasterLevels(): { peak: number; rms: number } {
		if (!this.masterAnalyser) return { peak: 0, rms: 0 };
		return this.readAnalyserLevels(this.masterAnalyser);
	}

	private readAnalyserLevels(analyser: AnalyserNode): {
		peak: number;
		rms: number;
	} {
		const bufferLength = analyser.fftSize;
		const dataArray = new Float32Array(bufferLength);
		analyser.getFloatTimeDomainData(dataArray);

		let peak = 0;
		let sumSquares = 0;
		for (let i = 0; i < bufferLength; i++) {
			const abs = Math.abs(dataArray[i]);
			if (abs > peak) peak = abs;
			sumSquares += dataArray[i] * dataArray[i];
		}
		const rms = Math.sqrt(sumSquares / bufferLength);
		return { peak, rms };
	}

	updateTrackVolume(trackId: string, volume: number): void {
		const nodes = this.trackNodes.get(trackId);
		if (nodes) {
			nodes.gain.gain.value = volume;
		}
	}

	updateTrackPan(trackId: string, pan: number): void {
		const nodes = this.trackNodes.get(trackId);
		if (nodes) {
			nodes.panner.pan.value = pan;
		}
	}

	private getTrackDestination(clipId: string): AudioNode {
		const ctx = this.audioContext;
		if (!ctx || !this.masterGain) return ctx?.destination ?? this.masterGain!;

		const tracks = this.editor.timeline.getTracks();
		const trackWithClip = tracks.find((t) =>
			t.elements.some((el) => el.id === clipId),
		);

		if (!trackWithClip) return this.masterGain;

		const trackNodes = this.getOrCreateTrackNodes(trackWithClip.id);
		if (!trackNodes) return this.masterGain;

		const isSoloMode = tracks.some(
			(t) => "solo" in t && t.solo,
		);
		const trackSolo = "solo" in trackWithClip ? trackWithClip.solo : false;

		if (isSoloMode && !trackSolo) {
			const silentGain = ctx.createGain();
			silentGain.gain.value = 0;
			silentGain.connect(this.masterGain);
			return silentGain;
		}

		return trackNodes.gain;
	}

	private getPlaybackTime(): number {
		if (!this.audioContext) return this.playbackStartTime;
		const elapsed =
			this.audioContext.currentTime - this.playbackStartContextTime;
		return this.playbackStartTime + elapsed;
	}

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		this.rebuildTrackNodes();
		this.playbackSessionId++;
		this.playbackLatencyCompensationSeconds = 0;

		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}

		this.clips = await collectAudioClips({ tracks, mediaAssets });
		if (!this.editor.playback.getIsPlaying()) return;

		this.playbackStartTime = time;
		this.playbackStartContextTime = audioContext.currentTime;

		this.scheduleUpcomingClips();

		if (typeof window !== "undefined") {
			this.scheduleTimer = window.setInterval(() => {
				this.scheduleUpcomingClips();
			}, this.scheduleIntervalMs);
		}
	}

	private scheduleUpcomingClips(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const currentTime = this.getPlaybackTime();
		const windowEnd = currentTime + this.lookaheadSeconds;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (this.activeClipIds.has(clip.id)) continue;

			const clipEnd = clip.startTime + clip.duration;
			if (clipEnd <= currentTime) continue;
			if (clip.startTime > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			void this.runClipIterator({
				clip,
				startTime: currentTime,
				sessionId: this.playbackSessionId,
			});
		}
	}

	private stopPlayback(): void {
		if (this.scheduleTimer && typeof window !== "undefined") {
			window.clearInterval(this.scheduleTimer);
		}
		this.scheduleTimer = null;

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const source of this.queuedSources) {
			try {
				source.stop();
			} catch {}
			source.disconnect();
		}
		this.queuedSources.clear();
	}

	private async runClipIterator({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		const sink = await this.getAudioSink({ clip });
		if (!sink || !this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;
		const playbackTimeAfterSinkReady = this.getPlaybackTime();
		const iteratorStartTime = Math.max(
			startTime,
			clipStart,
			playbackTimeAfterSinkReady,
		);
		if (iteratorStartTime >= clipEnd) {
			return;
		}
		const sourceStartTime =
			clip.trimStart + (iteratorStartTime - clip.startTime);

		let iterator: AsyncGenerator<WrappedAudioBuffer, void, unknown>;
		try {
			iterator = sink.buffers(sourceStartTime);
		} catch {
			return; // Sink may have been disposed
		}
		this.clipIterators.set(clip.id, iterator);
		let consecutiveDroppedBufferCount = 0;

		try {
			for await (const { buffer, timestamp } of iterator) {
				if (!this.editor.playback.getIsPlaying()) return;
				if (sessionId !== this.playbackSessionId) return;

				const timelineTime = clip.startTime + (timestamp - clip.trimStart);
				if (timelineTime >= clipEnd) break;

				const node = audioContext.createBufferSource();
				node.buffer = buffer;

				// Apply per-clip playback rate (speed control)
				const clipRate = (clip as unknown as { playbackRate?: number }).playbackRate;
				if (typeof clipRate === "number" && clipRate !== 1.0) {
					node.playbackRate.value = clipRate;
				}

				const destinationNode = this.getTrackDestination(clip.id);

				const clipVolume = clip.volume ?? 1;
				if (clipVolume < 1) {
					const clipGain = audioContext.createGain();
					clipGain.gain.value = clipVolume;
					node.connect(clipGain);
					clipGain.connect(destinationNode);
				} else {
					node.connect(destinationNode);
				}

				const startTimestamp =
					this.playbackStartContextTime +
					this.playbackLatencyCompensationSeconds +
					(timelineTime - this.playbackStartTime);

				if (startTimestamp >= audioContext.currentTime) {
					node.start(startTimestamp);
					consecutiveDroppedBufferCount = 0;
				} else {
					const offset = audioContext.currentTime - startTimestamp;
					if (offset < buffer.duration) {
						node.start(audioContext.currentTime, offset);
						consecutiveDroppedBufferCount = 0;
					} else {
						consecutiveDroppedBufferCount += 1;
						if (consecutiveDroppedBufferCount >= 5) {
							const nextCompensationSeconds = Math.max(
								this.playbackLatencyCompensationSeconds,
								Math.min(0.25, offset + 0.01),
							);
							if (
								nextCompensationSeconds >
								this.playbackLatencyCompensationSeconds + 0.001
							) {
								this.playbackLatencyCompensationSeconds =
									nextCompensationSeconds;
							}
							const resyncStartTime = this.getPlaybackTime();
							this.clipIterators.delete(clip.id);
							void this.runClipIterator({
								clip,
								startTime: resyncStartTime,
								sessionId,
							});
							return;
						}
						continue;
					}
				}

				this.queuedSources.add(node);
				node.addEventListener("ended", () => {
					node.disconnect();
					this.queuedSources.delete(node);
				});

				const aheadTime = timelineTime - this.getPlaybackTime();
				if (aheadTime >= 1) {
					await this.waitUntilCaughtUp({ timelineTime, targetAhead: 1 });
					if (sessionId !== this.playbackSessionId) return;
				}
			}
		} catch {
			// Input may have been disposed (e.g., track deleted during playback)
		}

		this.clipIterators.delete(clip.id);
		// don't remove from activeClipIds - prevents scheduler from restarting this clip
		// the set is cleared on stopPlayback anyway
	}

	private waitUntilCaughtUp({
		timelineTime,
		targetAhead,
	}: {
		timelineTime: number;
		targetAhead: number;
	}): Promise<void> {
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (!this.editor.playback.getIsPlaying()) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				const playbackTime = this.getPlaybackTime();
				if (timelineTime - playbackTime < targetAhead) {
					clearInterval(checkInterval);
					resolve();
				}
			}, 100);
		});
	}

	private disposeSinks(): void {
		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const input of this.inputs.values()) {
			input.dispose();
		}
		this.inputs.clear();
		this.sinks.clear();

		for (const [, nodes] of this.trackNodes) {
			try {
				nodes.gain.disconnect();
				nodes.panner.disconnect();
				nodes.analyser.disconnect();
			} catch {}
		}
		this.trackNodes.clear();
	}

	private async getAudioSink({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBufferSink | null> {
		const existingSink = this.sinks.get(clip.sourceKey);
		if (existingSink) return existingSink;

		try {
			const input = new Input({
				source: new BlobSource(clip.file),
				formats: ALL_FORMATS,
			});
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				input.dispose();
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			this.inputs.set(clip.sourceKey, input);
			this.sinks.set(clip.sourceKey, sink);
			return sink;
		} catch (error) {
			console.warn("Failed to initialize audio sink:", error);
			return null;
		}
	}
}
