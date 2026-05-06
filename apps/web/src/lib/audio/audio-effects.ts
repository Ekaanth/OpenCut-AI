export type AudioEffectType =
	| "eq"
	| "compressor"
	| "noise-gate"
	| "reverb"
	| "de-esser"
	| "limiter";

export interface AudioEffectParam {
	key: string;
	label: string;
	type: "number";
	default: number;
	min: number;
	max: number;
	step: number;
	unit?: string;
}

export interface AudioEffectDefinition {
	type: AudioEffectType;
	name: string;
	keywords: string[];
	params: AudioEffectParam[];
	createNodes: (ctx: AudioContext, params: Record<string, number>) => AudioNode[];
}

export const AUDIO_EFFECT_DEFINITIONS: Record<AudioEffectType, AudioEffectDefinition> = {
	eq: {
		type: "eq",
		name: "EQ",
		keywords: ["equalizer", "eq", "tone", "frequency", "bass", "treble"],
		params: [
			{ key: "lowGain", label: "Low", type: "number", default: 0, min: -12, max: 12, step: 0.5, unit: "dB" },
			{ key: "midGain", label: "Mid", type: "number", default: 0, min: -12, max: 12, step: 0.5, unit: "dB" },
			{ key: "highGain", label: "High", type: "number", default: 0, min: -12, max: 12, step: 0.5, unit: "dB" },
			{ key: "lowFreq", label: "Low Freq", type: "number", default: 320, min: 60, max: 1000, step: 10, unit: "Hz" },
			{ key: "highFreq", label: "High Freq", type: "number", default: 3200, min: 1000, max: 16000, step: 100, unit: "Hz" },
		],
		createNodes: (ctx, params) => {
			const low = ctx.createBiquadFilter();
			low.type = "lowshelf";
			low.frequency.value = params.lowGain !== undefined ? (params.lowFreq as number) : 320;
			low.gain.value = params.lowGain ?? 0;

			const mid = ctx.createBiquadFilter();
			mid.type = "peaking";
			mid.frequency.value = 1000;
			mid.Q.value = 1.0;
			mid.gain.value = params.midGain ?? 0;

			const high = ctx.createBiquadFilter();
			high.type = "highshelf";
			high.frequency.value = params.highFreq ?? 3200;
			high.gain.value = params.highGain ?? 0;

			low.connect(mid);
			mid.connect(high);
			return [low, high];
		},
	},
	compressor: {
		type: "compressor",
		name: "Compressor",
		keywords: ["compressor", "dynamic", "range", "volume", "leveling"],
		params: [
			{ key: "threshold", label: "Threshold", type: "number", default: -24, min: -60, max: 0, step: 1, unit: "dB" },
			{ key: "ratio", label: "Ratio", type: "number", default: 4, min: 1, max: 20, step: 0.5, unit: ":1" },
			{ key: "attack", label: "Attack", type: "number", default: 10, min: 0, max: 200, step: 1, unit: "ms" },
			{ key: "release", label: "Release", type: "number", default: 100, min: 10, max: 1000, step: 10, unit: "ms" },
			{ key: "makeupGain", label: "Makeup", type: "number", default: 0, min: 0, max: 24, step: 0.5, unit: "dB" },
		],
		createNodes: (ctx, params) => {
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = params.threshold ?? -24;
			comp.ratio.value = params.ratio ?? 4;
			comp.attack.value = (params.attack ?? 10) / 1000;
			comp.release.value = (params.release ?? 100) / 1000;
			comp.knee.value = 6;

			const makeup = ctx.createGain();
			makeup.gain.value = Math.pow(10, (params.makeupGain ?? 0) / 20);
			comp.connect(makeup);
			return [comp, makeup];
		},
	},
	"noise-gate": {
		type: "noise-gate",
		name: "Noise Gate",
		keywords: ["gate", "noise", "silence", "threshold", "floor"],
		params: [
			{ key: "threshold", label: "Threshold", type: "number", default: -40, min: -80, max: 0, step: 1, unit: "dB" },
			{ key: "attack", label: "Attack", type: "number", default: 5, min: 0, max: 100, step: 1, unit: "ms" },
			{ key: "release", label: "Release", type: "number", default: 50, min: 10, max: 500, step: 10, unit: "ms" },
		],
		createNodes: (ctx, params) => {
			const gate = ctx.createDynamicsCompressor();
			gate.threshold.value = params.threshold ?? -40;
			gate.ratio.value = 20;
			gate.attack.value = (params.attack ?? 5) / 1000;
			gate.release.value = (params.release ?? 50) / 1000;
			gate.knee.value = 1;
			return [gate];
		},
	},
	reverb: {
		type: "reverb",
		name: "Reverb",
		keywords: ["reverb", "room", "hall", "ambience", "echo", "space"],
		params: [
			{ key: "roomSize", label: "Room Size", type: "number", default: 50, min: 0, max: 100, step: 1, unit: "%" },
			{ key: "damping", label: "Damping", type: "number", default: 50, min: 0, max: 100, step: 1, unit: "%" },
			{ key: "wetLevel", label: "Wet Level", type: "number", default: 30, min: 0, max: 100, step: 1, unit: "%" },
		],
		createNodes: (ctx, params) => {
			const convolver = ctx.createConvolver();
			const wet = ctx.createGain();
			const dry = ctx.createGain();
			const merger = ctx.createGain();

			const roomSize = (params.roomSize ?? 50) / 100;
			const damping = (params.damping ?? 50) / 100;
			const wetLevel = (params.wetLevel ?? 30) / 100;

			const sampleRate = ctx.sampleRate;
			const length = sampleRate * (0.5 + roomSize * 3);
			const impulse = ctx.createBuffer(2, length, sampleRate);

			for (let channel = 0; channel < 2; channel++) {
				const data = impulse.getChannelData(channel);
				for (let i = 0; i < length; i++) {
					const decay = Math.pow(1 - damping, i / sampleRate);
					data[i] = (Math.random() * 2 - 1) * decay * Math.exp(-i / (length * 0.3));
				}
			}

			convolver.buffer = impulse;
			wet.gain.value = wetLevel;
			dry.gain.value = 1;

			convolver.connect(wet);
			wet.connect(merger);
			dry.connect(merger);

			return [convolver, merger];
		},
	},
	"de-esser": {
		type: "de-esser",
		name: "De-esser",
		keywords: ["de-esser", "sibilance", "ess", "shh", "harsh", "sss"],
		params: [
			{ key: "frequency", label: "Frequency", type: "number", default: 6000, min: 2000, max: 12000, step: 100, unit: "Hz" },
			{ key: "threshold", label: "Threshold", type: "number", default: -30, min: -60, max: 0, step: 1, unit: "dB" },
			{ key: "reduction", label: "Reduction", type: "number", default: 10, min: 0, max: 30, step: 1, unit: "dB" },
		],
		createNodes: (ctx, params) => {
			const filter = ctx.createBiquadFilter();
			filter.type = "peaking";
			filter.frequency.value = params.frequency ?? 6000;
			filter.Q.value = 2.0;

			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = params.threshold ?? -30;
			comp.ratio.value = 12;
			comp.attack.value = 0.001;
			comp.release.value = 0.05;
			comp.knee.value = 3;

			filter.connect(comp);
			return [filter, comp];
		},
	},
	limiter: {
		type: "limiter",
		name: "Limiter",
		keywords: ["limiter", "brick", "wall", "ceiling", "clip", "protect"],
		params: [
			{ key: "ceiling", label: "Ceiling", type: "number", default: -1, min: -6, max: 0, step: 0.1, unit: "dB" },
			{ key: "release", label: "Release", type: "number", default: 50, min: 10, max: 500, step: 10, unit: "ms" },
		],
		createNodes: (ctx, params) => {
			const limiter = ctx.createDynamicsCompressor();
			limiter.threshold.value = params.ceiling ?? -1;
			limiter.ratio.value = 20;
			limiter.attack.value = 0.001;
			limiter.release.value = (params.release ?? 50) / 1000;
			limiter.knee.value = 0;
			return [limiter];
		},
	},
};

export function getAudioEffectDefinition(type: AudioEffectType): AudioEffectDefinition {
	return AUDIO_EFFECT_DEFINITIONS[type];
}

export function getAllAudioEffectDefinitions(): AudioEffectDefinition[] {
	return Object.values(AUDIO_EFFECT_DEFINITIONS);
}
