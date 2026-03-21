import type {
	AIBackendStatus,
	AIErrorType,
	AISuggestion,
	CommandResult,
	DenoiseResult,
	ImageGenParams,
	ImageGenResult,
	InfographicData,
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

class AIClient {
	private baseUrl: string;

	constructor() {
		this.baseUrl =
			process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420";
	}

	getBaseUrl(): string {
		return this.baseUrl;
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
