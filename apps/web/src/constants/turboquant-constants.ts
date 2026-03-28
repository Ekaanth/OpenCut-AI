/**
 * TurboQuant optimization constants.
 *
 * TurboQuant achieves 3-bit KV cache quantization with zero accuracy loss
 * using PolarQuant + QJL. These constants define model tiers, memory budgets,
 * and quantization configurations for the frontend UI.
 */

// ---------------------------------------------------------------------------
// Memory budget presets
// ---------------------------------------------------------------------------

export const MEMORY_BUDGETS = [
	{ value: "auto", label: "Auto-detect", description: "Automatically detect available RAM" },
	{ value: "4GB", label: "4 GB", description: "Entry-level: Lite models only" },
	{ value: "8GB", label: "8 GB", description: "Standard: 3B models with quantization" },
	{ value: "16GB", label: "16 GB", description: "Pro: 7B-8B models with TurboQuant" },
	{ value: "32GB", label: "32 GB", description: "Full: All models, full context" },
] as const;

// ---------------------------------------------------------------------------
// Model tiers (mirrors backend model_registry.py)
// ---------------------------------------------------------------------------

export const MODEL_TIERS = [
	{
		name: "lite" as const,
		label: "Lite",
		description: "Minimal footprint — runs on 4-8 GB RAM",
		ramRange: "4-8 GB",
		defaultModel: "llama3.2:1b",
		quality: "Good",
	},
	{
		name: "standard" as const,
		label: "Standard",
		description: "Best quality/size balance — 8-16 GB RAM",
		ramRange: "8-16 GB",
		defaultModel: "llama3.2:3b-instruct-q4_K_M",
		quality: "Great",
	},
	{
		name: "pro" as const,
		label: "Pro",
		description: "Maximum quality — 16-32+ GB RAM or GPU",
		ramRange: "16-32+ GB",
		defaultModel: "llama3.1:8b-instruct-q4_K_M",
		quality: "Excellent",
	},
] as const;

// ---------------------------------------------------------------------------
// KV cache quantization configurations
// ---------------------------------------------------------------------------

export const KV_CACHE_CONFIGS = [
	{
		bits: 4,
		label: "4-bit (Recommended)",
		compressionRatio: 3.8,
		cosineSimilarity: 0.9986,
		quality: "Near-lossless",
		description: "Safe for all production workloads. 74% memory reduction.",
		recommended: true,
	},
	{
		bits: 3,
		label: "3-bit (Efficiency)",
		compressionRatio: 5.0,
		cosineSimilarity: 0.9953,
		quality: "Minor degradation",
		description: "Good for most tasks. 80% memory reduction.",
		recommended: false,
	},
	{
		bits: 2,
		label: "2-bit (Aggressive)",
		compressionRatio: 7.3,
		cosineSimilarity: 0.9874,
		quality: "Noticeable loss",
		description: "Extreme compression. Avoid for creative tasks. 86% memory reduction.",
		recommended: false,
	},
] as const;

// ---------------------------------------------------------------------------
// Quantization format labels (for Ollama GGUF models)
// ---------------------------------------------------------------------------

export const QUANTIZATION_LABELS: Record<string, string> = {
	fp16: "FP16 (Full precision)",
	q8_0: "Q8 (8-bit)",
	q5_K_M: "Q5_K_M (5-bit)",
	q4_K_M: "Q4_K_M (4-bit)",
	q3_K_M: "Q3_K_M (3-bit)",
	q2_K: "Q2_K (2-bit)",
};

// ---------------------------------------------------------------------------
// Stack memory benchmarks (from TURBOQUANT_INTEGRATION.md)
// ---------------------------------------------------------------------------

export const STACK_BENCHMARKS = {
	withoutTurboQuant: {
		"ollama_3b_whisper_base_tts": { label: "Ollama 3B + Whisper + TTS", memoryGb: 12 },
		"ollama_7b_whisper_medium_tts_sd": { label: "Ollama 7B + Whisper Medium + TTS + SD", memoryGb: 30 },
		"full_stack": { label: "Full stack (all services)", memoryGb: 35 },
	},
	withTurboQuant: {
		"ollama_3b_whisper_base_tts": { label: "Ollama 3B + Whisper + TTS", memoryGb: 5 },
		"ollama_7b_whisper_medium_tts_sd": { label: "Ollama 7B + Whisper Medium + TTS + SD", memoryGb: 12 },
		"full_stack": { label: "Full stack (all services)", memoryGb: 15 },
	},
} as const;

export type MemoryBudget = (typeof MEMORY_BUDGETS)[number]["value"];
export type ModelTierName = (typeof MODEL_TIERS)[number]["name"];
