import type {
	AIBackendStatus,
	AIErrorType,
	AISuggestion,
	CommandResult,
	DenoiseResult,
	EmotionDetectionResult,
	FaceDetectionResult,
	FindClipsResult,
	SpeakerDiarizationResult,
	ImageGenParams,
	ImageGenResult,
	InfographicData,
	KeywordResult,
	QuestionCardsResult,
	TranscriptionResult,
	TranscriptionSegment,
	FillerWord,
	SilenceRegion,
	StructureAnalysis,
	TTSRequest,
	TTSResult,
} from "@/types/ai";

interface MemoryStatus {
	allocated: number;
	reserved: number;
	total: number;
}

export interface ServiceInfo {
	status: string;
	version?: string;
	port?: number;
	url?: string;
	models?: { name: string; size: number; modified_at: string }[];
	default_model?: string;
	model_size?: string;
	device?: string;
	description?: string;
}

export interface ServicesStatus {
	services: {
		backend: ServiceInfo;
		ollama: ServiceInfo;
		whisper: ServiceInfo;
		tts: ServiceInfo;
		diffusion: ServiceInfo;
	};
	memory: Record<string, unknown>;
	active_model: string | null;
}

const HEALTH_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 120_000;

export class AIClientError extends Error {
	readonly errorType: AIErrorType;
	readonly statusCode?: number;

	constructor(message: string, errorType: AIErrorType, statusCode?: number) {
		super(message);
		this.name = "AIClientError";
		this.errorType = errorType;
		this.statusCode = statusCode;
	}
}

function classifyError(error: unknown): { message: string; errorType: AIErrorType } {
	if (error instanceof AIClientError) {
		return { message: error.message, errorType: error.errorType };
	}

	if (error instanceof DOMException && error.name === "AbortError") {
		return {
			message: "Request timed out. The AI backend may be overloaded or starting up.",
			errorType: "timeout",
		};
	}

	if (error instanceof TypeError && error.message.includes("fetch")) {
		return {
			message: "Cannot connect to AI backend. Make sure it is running.",
			errorType: "connection_refused",
		};
	}

	const message = error instanceof Error ? error.message : "An unknown error occurred";

	if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("ERR_CONNECTION_REFUSED")) {
		return {
			message: "Cannot connect to AI backend. Make sure it is running on the correct port.",
			errorType: "connection_refused",
		};
	}

	if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
		return {
			message: "AI backend not found. Check that the server is started.",
			errorType: "connection_refused",
		};
	}

	return { message, errorType: "unknown" };
}

/** Read an API key from localStorage (set via the Settings panel). */
function getStoredApiKey(key: string): string {
	if (typeof window === "undefined") return "";
	try {
		const stored = localStorage.getItem("opencut-api-keys");
		if (!stored) return "";
		const keys = JSON.parse(stored) as Record<string, string>;
		return keys[key]?.trim() || "";
	} catch {
		return "";
	}
}

class AIClient {
	private baseUrl: string;

	constructor() {
		this.baseUrl =
			process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420";
	}

	getBaseUrl(): string {
		return this.baseUrl;
	}

	/** Get the Sarvam API key from localStorage or env. */
	private getSarvamApiKey(): string {
		return (
			getStoredApiKey("sarvam") ||
			process.env.NEXT_PUBLIC_SARVAM_API_KEY ||
			""
		);
	}

	/** Build extra headers that include the Sarvam API key for passthrough. */
	private sarvamHeaders(): Record<string, string> {
		const key = this.getSarvamApiKey();
		if (!key) return {};
		return { "X-Sarvam-Api-Key": key };
	}

	/** Get the Smallest AI API key from localStorage or env. */
	private getSmallestApiKey(): string {
		return (
			getStoredApiKey("smallest") ||
			process.env.NEXT_PUBLIC_SMALLEST_API_KEY ||
			""
		);
	}

	/** Build extra headers that include the Smallest AI API key for passthrough. */
	private smallestHeaders(): Record<string, string> {
		const key = this.getSmallestApiKey();
		if (!key) return {};
		return { "X-Smallest-Api-Key": key };
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		timeoutMs: number = REQUEST_TIMEOUT_MS,
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
				headers: {
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`AI Backend error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return response.json() as Promise<T>;
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private async requestFormData<T>(
		endpoint: string,
		formData: FormData,
		timeoutMs: number = REQUEST_TIMEOUT_MS,
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(url, {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`AI Backend error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return response.json() as Promise<T>;
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async health(): Promise<AIBackendStatus> {
		return this.request<AIBackendStatus>("/health", {}, HEALTH_TIMEOUT_MS);
	}

	async transcribe(
		file: File,
		language?: string,
	): Promise<TranscriptionResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (language) {
			formData.append("language", language);
		}

		return this.requestFormData<TranscriptionResult>(
			"/api/transcribe",
			formData,
		);
	}

	async analyzeFillers(
		file: File,
		fillerWords?: string,
		threshold?: number,
	): Promise<{ fillers: FillerWord[]; total_count: number; duration: number; filler_density: number }> {
		const formData = new FormData();
		formData.append("file", file);
		if (fillerWords) formData.append("filler_words", fillerWords);
		if (threshold !== undefined) formData.append("threshold", threshold.toString());

		return this.requestFormData("/api/analyze/fillers", formData);
	}

	async analyzeSilences(
		file: File,
		thresholdDb?: number,
		minDuration?: number,
	): Promise<{ silences: SilenceRegion[]; total_count: number; total_silence_duration: number }> {
		const formData = new FormData();
		formData.append("file", file);
		if (thresholdDb !== undefined) formData.append("threshold_db", thresholdDb.toString());
		if (minDuration !== undefined) formData.append("min_duration", minDuration.toString());

		return this.requestFormData("/api/analyze/silences", formData);
	}

	async analyzeStructure(
		file: File,
		language?: string,
	): Promise<StructureAnalysis> {
		const formData = new FormData();
		formData.append("file", file);
		if (language) formData.append("language", language);

		return this.requestFormData("/api/analyze/structure", formData);
	}

	async getSuggestions(
		file: File,
		language?: string,
	): Promise<{ suggestions: AISuggestion[]; duration: number }> {
		const formData = new FormData();
		formData.append("file", file);
		if (language) formData.append("language", language);

		return this.requestFormData("/api/analyze/suggestions", formData);
	}

	async executeCommand(
		command: string,
		timelineState: unknown,
	): Promise<CommandResult> {
		return this.request<CommandResult>("/api/llm/command", {
			method: "POST",
			body: JSON.stringify({ command, timelineState }),
		});
	}

	async generateImage(params: ImageGenParams): Promise<ImageGenResult> {
		return this.request<ImageGenResult>("/api/generate/image", {
			method: "POST",
			body: JSON.stringify(params),
		});
	}

	async enhancePrompt(
		prompt: string,
		style?: string,
	): Promise<{ enhanced: string; original: string; style: string }> {
		return this.request<{ enhanced: string; original: string; style: string }>(
			"/api/generate/enhance-prompt",
			{
				method: "POST",
				body: JSON.stringify({ prompt, style: style ?? "photorealistic" }),
			},
		);
	}

	async generateInfographic(
		topic: string,
		dataPoints?: { label: string; value: string }[],
		style?: string,
	): Promise<InfographicData> {
		return this.request<InfographicData>("/api/generate/infographic", {
			method: "POST",
			body: JSON.stringify({
				topic,
				data_points: dataPoints ?? [],
				style: style ?? "modern",
			}),
		});
	}

	async removeBackground(file: File): Promise<{ imageUrl: string }> {
		const formData = new FormData();
		formData.append("file", file);

		return this.requestFormData<{ imageUrl: string }>(
			"/api/generate/remove-bg",
			formData,
		);
	}

	async generateSpeech(request: TTSRequest): Promise<TTSResult> {
		return this.request<TTSResult>("/api/tts/generate", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	async generateSpeechBlob(request: TTSRequest): Promise<Blob> {
		const url = `${this.baseUrl}/api/tts/generate`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`TTS error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return await response.blob();
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async cloneVoice(file: File, name: string): Promise<{ status: string; name: string; path: string }> {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("name", name);

		return this.requestFormData<{ status: string; name: string; path: string }>(
			"/api/tts/clone-voice",
			formData,
		);
	}

	async generateSubtitles(
		segments: TranscriptionSegment[],
		format: string,
		maxCharsPerLine?: number,
	): Promise<{ content: string; format: string }> {
		return this.request<{ content: string; format: string }>(
			"/api/transcribe/subtitles",
			{
				method: "POST",
				body: JSON.stringify({ segments, format, max_chars_per_line: maxCharsPerLine }),
			},
		);
	}

	async chat(message: string, system?: string): Promise<{ response: string }> {
		return this.request<{ response: string }>("/api/llm/chat", {
			method: "POST",
			body: JSON.stringify({ message, system }),
		});
	}

	async translateText(
		text: string,
		targetLanguage: string,
	): Promise<string> {
		const result = await this.chat(
			`Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else. Do not add quotes, explanations, or notes.\n\n${text}`,
			`You are a professional translator. Translate accurately and naturally into ${targetLanguage}. Return only the translated text.`,
		);
		return result.response.trim();
	}

	// ── Sarvam AI (Indian Languages) ──────────────────────────────────

	async sarvamTranscribe(
		file: File,
		languageCode?: string,
		mode: string = "transcribe",
	): Promise<TranscriptionResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (languageCode) {
			formData.append("language_code", languageCode);
		}
		formData.append("model", "saaras:v3");
		formData.append("mode", mode);

		// Pass the Sarvam key via header so the backend can use it
		const url = `${this.baseUrl}/api/sarvam/transcribe`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				body: formData,
				signal: controller.signal,
				headers: this.sarvamHeaders(),
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`AI Backend error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return response.json() as Promise<TranscriptionResult>;
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async sarvamTranslate(
		text: string,
		sourceLanguageCode: string,
		targetLanguageCode: string,
		model: string = "sarvam-translate:v1",
	): Promise<{ translated_text: string; source_language_code: string }> {
		return this.request<{ translated_text: string; source_language_code: string }>(
			"/api/sarvam/translate",
			{
				method: "POST",
				headers: this.sarvamHeaders(),
				body: JSON.stringify({
					input: text,
					source_language_code: sourceLanguageCode,
					target_language_code: targetLanguageCode,
					model,
				}),
			},
		);
	}

	async sarvamTTS(
		text: string,
		targetLanguageCode: string,
		speaker: string = "shubh",
		pace: number = 1.0,
	): Promise<Blob> {
		const url = `${this.baseUrl}/api/sarvam/tts`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...this.sarvamHeaders(),
				},
				body: JSON.stringify({
					text,
					target_language_code: targetLanguageCode,
					speaker,
					pace,
					model: "bulbul:v3",
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`Sarvam TTS error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return await response.blob();
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async sarvamDetectLanguage(
		text: string,
	): Promise<{ language_code: string; script_code: string }> {
		return this.request<{ language_code: string; script_code: string }>(
			"/api/sarvam/detect-language",
			{
				method: "POST",
				headers: this.sarvamHeaders(),
				body: JSON.stringify({ input: text }),
			},
		);
	}

	async sarvamTransliterate(
		text: string,
		sourceLanguageCode: string,
		targetLanguageCode: string,
	): Promise<{ transliterated_text: string }> {
		return this.request<{ transliterated_text: string }>(
			"/api/sarvam/transliterate",
			{
				method: "POST",
				headers: this.sarvamHeaders(),
				body: JSON.stringify({
					input: text,
					source_language_code: sourceLanguageCode,
					target_language_code: targetLanguageCode,
				}),
			},
		);
	}

	async sarvamStatus(): Promise<{ available: boolean; reason?: string }> {
		return this.request<{ available: boolean; reason?: string }>(
			"/api/sarvam/status",
			{ headers: this.sarvamHeaders() },
			HEALTH_TIMEOUT_MS,
		);
	}

	// ── Smallest AI (Waves — Lightning TTS + Pulse STT) ─────────────

	async smallestTTS(
		text: string,
		voiceId: string = "emily",
		language: string = "auto",
		speed: number = 1.0,
		outputFormat: string = "mp3",
	): Promise<Blob> {
		const url = `${this.baseUrl}/api/smallest/tts`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...this.smallestHeaders(),
				},
				body: JSON.stringify({
					text,
					voice_id: voiceId,
					language,
					speed,
					output_format: outputFormat,
					sample_rate: 24000,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`Smallest TTS error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return await response.blob();
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async smallestTranscribe(
		file: File,
		language: string = "en",
	): Promise<TranscriptionResult> {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("language", language);

		const url = `${this.baseUrl}/api/smallest/transcribe`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				body: formData,
				signal: controller.signal,
				headers: this.smallestHeaders(),
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "Unknown error");
				throw new AIClientError(
					`Smallest STT error (${response.status}): ${errorBody}`,
					response.status >= 500 ? "backend_error" : "network_error",
					response.status,
				);
			}

			return response.json() as Promise<TranscriptionResult>;
		} catch (error) {
			if (error instanceof AIClientError) throw error;
			const classified = classifyError(error);
			throw new AIClientError(classified.message, classified.errorType);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async smallestVoices(): Promise<{
		voices: { id: string; name: string; language: string; gender: string }[];
		languages: { code: string; name: string; status: string }[];
	}> {
		return this.request("/api/smallest/voices", {
			headers: this.smallestHeaders(),
		});
	}

	async smallestStatus(): Promise<{ available: boolean; reason?: string }> {
		return this.request<{ available: boolean; reason?: string }>(
			"/api/smallest/status",
			{ headers: this.smallestHeaders() },
			HEALTH_TIMEOUT_MS,
		);
	}

	async factCheck(text: string): Promise<{
		claims: {
			claim: string;
			verdict: string;
			confidence: string;
			explanation: string;
			source: string;
		}[];
		summary: string;
	}> {
		return this.request("/api/factcheck", {
			method: "POST",
			body: JSON.stringify({ text }),
		});
	}

	async llmStatus(): Promise<{ available: boolean; models: string[] }> {
		return this.request<{ available: boolean; models: string[] }>(
			"/api/llm/status",
		);
	}

	async pullModel(modelName: string): Promise<void> {
		await this.request<void>("/api/llm/pull-model", {
			method: "POST",
			body: JSON.stringify({ model: modelName }),
		});
	}

	async downloadModel(
		modelName: string,
		onProgress?: (progress: number) => void,
	): Promise<void> {
		const url = `${this.baseUrl}/api/setup/download-model`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: modelName }),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "Unknown error");
			throw new Error(
				`AI Backend error (${response.status}): ${errorBody}`,
			);
		}

		if (!response.body) {
			return;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk.split("\n").filter(Boolean);

			for (const line of lines) {
				try {
					const data = JSON.parse(line) as { progress?: number };
					if (data.progress !== undefined && onProgress) {
						onProgress(data.progress);
					}
				} catch {
					// skip non-JSON lines
				}
			}
		}
	}

	async getMemoryStatus(): Promise<MemoryStatus> {
		return this.request<MemoryStatus>("/api/system/memory");
	}

	async getServicesStatus(): Promise<ServicesStatus> {
		return this.request<ServicesStatus>("/api/services/status", {}, HEALTH_TIMEOUT_MS);
	}

	async pullOllamaModel(modelName: string): Promise<{ status: string; model: string }> {
		return this.request<{ status: string; model: string }>("/api/llm/pull-model", {
			method: "POST",
			body: JSON.stringify({ model: modelName }),
		});
	}

	async prepareWhisper(modelSize?: string): Promise<{ status: string; message: string }> {
		return this.request<{ status: string; message: string }>("/api/setup/download-model", {
			method: "POST",
			body: JSON.stringify({ model_type: "whisper", model_name: modelSize ?? "" }),
		});
	}

	async prepareTTS(): Promise<{ status: string; message: string }> {
		return this.request<{ status: string; message: string }>("/api/setup/download-model", {
			method: "POST",
			body: JSON.stringify({ model_type: "tts", model_name: "" }),
		});
	}

	async prepareDiffusion(): Promise<{ status: string; message: string }> {
		return this.request<{ status: string; message: string }>("/api/setup/download-model", {
			method: "POST",
			body: JSON.stringify({ model_type: "diffusion", model_name: "" }),
		});
	}

	async analyzeEmotions(
		file: File,
		windowSeconds?: number,
	): Promise<EmotionDetectionResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (windowSeconds !== undefined) formData.append("window_seconds", windowSeconds.toString());

		return this.requestFormData<EmotionDetectionResult>(
			"/api/analyze/emotions",
			formData,
			300_000,
		);
	}

	async detectFaces(
		file: File,
		options?: { sampleInterval?: number; maxSamples?: number },
	): Promise<FaceDetectionResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (options?.sampleInterval !== undefined) formData.append("sample_interval", options.sampleInterval.toString());
		if (options?.maxSamples !== undefined) formData.append("max_samples", options.maxSamples.toString());

		return this.requestFormData<FaceDetectionResult>(
			"/api/analyze/faces",
			formData,
			300_000, // 5 min timeout
		);
	}

	async analyzeSpeakers(
		file: File,
		options?: { numSpeakers?: number; minSpeakers?: number; maxSpeakers?: number },
	): Promise<SpeakerDiarizationResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (options?.numSpeakers !== undefined) formData.append("num_speakers", options.numSpeakers.toString());
		if (options?.minSpeakers !== undefined) formData.append("min_speakers", options.minSpeakers.toString());
		if (options?.maxSpeakers !== undefined) formData.append("max_speakers", options.maxSpeakers.toString());

		return this.requestFormData<SpeakerDiarizationResult>(
			"/api/analyze/speakers",
			formData,
			600_000, // 10 min timeout for diarization
		);
	}

	async findClips(
		segments: { id: number; text: string; start: number; end: number; words: { word: string; start: number; end: number; confidence: number }[] }[],
		options?: { minDuration?: number; maxDuration?: number; maxClips?: number },
	): Promise<FindClipsResult> {
		return this.request<FindClipsResult>("/api/analyze/find-clips", {
			method: "POST",
			body: JSON.stringify({
				segments,
				min_duration: options?.minDuration ?? 15,
				max_duration: options?.maxDuration ?? 90,
				max_clips: options?.maxClips ?? 10,
			}),
		});
	}

	async extractKeywords(
		segments: { id: number; text: string; start: number; end: number; words: { word: string; start: number; end: number; confidence: number }[] }[],
	): Promise<KeywordResult> {
		return this.request<KeywordResult>("/api/analyze/keywords", {
			method: "POST",
			body: JSON.stringify({ segments }),
		});
	}

	async generateQuestionCards(
		segments: { id: number; text: string; start: number; end: number; words: { word: string; start: number; end: number; confidence: number }[] }[],
		maxCards?: number,
	): Promise<QuestionCardsResult> {
		return this.request<QuestionCardsResult>("/api/analyze/question-cards", {
			method: "POST",
			body: JSON.stringify({ segments, max_cards: maxCards ?? 5 }),
		});
	}

	async denoiseAudio(
		file: File,
		strength: number,
	): Promise<DenoiseResult> {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("strength", strength.toString());

		return this.requestFormData<DenoiseResult>(
			"/api/audio/denoise",
			formData,
		);
	}

	async exportRender(
		projectData: unknown,
	): Promise<{ videoUrl: string }> {
		return this.request<{ videoUrl: string }>("/api/export/render", {
			method: "POST",
			body: JSON.stringify(projectData),
		});
	}
}

export const aiClient = new AIClient();
