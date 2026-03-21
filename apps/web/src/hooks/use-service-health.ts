import { useCallback, useEffect, useRef, useState } from "react";

// ----- Types -----

export type ServiceHealthStatus = "running" | "stopped" | "error";

export interface ServiceHealth {
	status: ServiceHealthStatus;
	detail?: string;
	model_loaded?: boolean;
	model_installed?: boolean;
	model_size?: string;
	model_name?: string;
	install_command?: string;
	models?: { name: string; size: number; modified_at: string }[];
	version?: string;
	[key: string]: unknown;
}

export interface AllServicesHealth {
	backend: ServiceHealth;
	ollama: ServiceHealth;
	whisper: ServiceHealth;
	tts: ServiceHealth;
	image: ServiceHealth;
}

// ----- Service URLs -----

export const SERVICE_URLS = {
	backend: process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420",
	ollama: "http://localhost:11434",
	whisper: process.env.NEXT_PUBLIC_WHISPER_SERVICE_URL || "http://localhost:8421",
	tts: process.env.NEXT_PUBLIC_TTS_SERVICE_URL || "http://localhost:8422",
	image: process.env.NEXT_PUBLIC_IMAGE_SERVICE_URL || "http://localhost:8423",
} as const;

export type ServiceName = keyof typeof SERVICE_URLS;

// ----- Docker commands -----

export const SERVICE_DOCKER_COMMANDS: Record<ServiceName, string> = {
	backend: "docker compose up -d ai-backend",
	ollama: "docker compose up -d ollama",
	whisper: "docker compose up -d whisper-service",
	tts: "docker compose up -d tts-service",
	image: "docker compose up -d image-service",
};

// ----- Health check function -----

export async function checkServiceHealth(baseUrl: string): Promise<ServiceHealth> {
	try {
		const url = baseUrl.endsWith("/health") ? baseUrl : `${baseUrl}/health`;
		const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!resp.ok) return { status: "error", detail: `HTTP ${resp.status}` };
		const data = await resp.json();

		// Normalize the response — services return different shapes
		const result: ServiceHealth = { status: "running" };

		// Extract model_loaded and model_installed from nested structures
		if (data.model && typeof data.model === "object") {
			result.model_loaded = data.model.loaded === true;
			result.model_installed = data.model.installed !== false; // true if not explicitly false
			result.model_size = data.model.model_size ?? data.model.model_name;
			result.model_name = data.model.model_name ?? data.model.model_size;
		}
		// Image service returns models.diffusion.loaded
		if (data.models && typeof data.models === "object" && data.models.diffusion) {
			result.model_loaded = data.models.diffusion.loaded === true;
			result.model_installed = data.models.diffusion.installed !== false;
			result.model_name = data.models.diffusion.model_name;
		}

		// Install command hint (shown when deps aren't installed)
		if (data.install_command) {
			result.install_command = data.install_command;
		}

		// Copy service name and version if present
		if (data.service) result.detail = data.service;
		if (data.version) result.version = data.version;
		// Keep supported_languages for TTS
		if (data.supported_languages) {
			(result as Record<string, unknown>).supported_languages = data.supported_languages;
		}

		return result;
	} catch {
		return { status: "stopped", detail: "Not reachable" };
	}
}

// Ollama uses a different health endpoint
async function checkOllamaHealth(): Promise<ServiceHealth> {
	try {
		// Ollama root endpoint returns 200 when running
		const resp = await fetch(SERVICE_URLS.ollama, { signal: AbortSignal.timeout(5000) });
		if (!resp.ok) return { status: "error", detail: `HTTP ${resp.status}` };

		// Also fetch models list
		try {
			const tagsResp = await fetch(`${SERVICE_URLS.ollama}/api/tags`, { signal: AbortSignal.timeout(5000) });
			if (tagsResp.ok) {
				const tagsData = await tagsResp.json();
				return { status: "running", models: tagsData.models ?? [] };
			}
		} catch {
			// Models list failed but ollama is running
		}

		return { status: "running" };
	} catch {
		return { status: "stopped", detail: "Not reachable" };
	}
}

// ----- Proxied health check via AI backend -----

/**
 * Fetch all service health from the AI backend's /services/health endpoint.
 * This avoids cross-origin issues since only the backend needs to be reachable.
 */
async function checkAllViaBackend(): Promise<AllServicesHealth> {
	const backendUrl = SERVICE_URLS.backend;
	try {
		const resp = await fetch(`${backendUrl}/services/health`, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const data = await resp.json();

		const toHealth = (entry: Record<string, unknown> | undefined): ServiceHealth => {
			if (!entry || typeof entry !== "object") return { status: "stopped" };
			return entry as ServiceHealth;
		};

		return {
			backend: toHealth(data.backend),
			ollama: toHealth(data.ollama),
			whisper: toHealth(data.whisper),
			tts: toHealth(data.tts),
			image: toHealth(data.image),
		};
	} catch {
		// Backend itself is not reachable — fall back to direct checks
		const [backend, ollama, whisper, tts, image] = await Promise.all([
			checkServiceHealth(SERVICE_URLS.backend),
			checkOllamaHealth(),
			checkServiceHealth(SERVICE_URLS.whisper),
			checkServiceHealth(SERVICE_URLS.tts),
			checkServiceHealth(SERVICE_URLS.image),
		]);
		return { backend, ollama, whisper, tts, image };
	}
}

// ----- Hook -----

const POLL_INTERVAL = 30_000;

export function useServiceHealth(pollEnabled = true) {
	const [services, setServices] = useState<AllServicesHealth>({
		backend: { status: "stopped" },
		ollama: { status: "stopped" },
		whisper: { status: "stopped" },
		tts: { status: "stopped" },
		image: { status: "stopped" },
	});
	const [isChecking, setIsChecking] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const checkAll = useCallback(async () => {
		setIsChecking(true);
		try {
			const result = await checkAllViaBackend();
			setServices(result);
		} finally {
			setIsChecking(false);
		}
	}, []);

	useEffect(() => {
		checkAll();

		if (pollEnabled) {
			intervalRef.current = setInterval(checkAll, POLL_INTERVAL);
			return () => {
				if (intervalRef.current) clearInterval(intervalRef.current);
			};
		}
	}, [checkAll, pollEnabled]);

	const loadModel = useCallback(async (service: "whisper" | "tts" | "image") => {
		const url = SERVICE_URLS[service];
		let resp: Response;
		try {
			resp = await fetch(`${url}/load`, {
				method: "POST",
				signal: AbortSignal.timeout(300_000),
			});
		} catch (error) {
			throw new Error(
				`Cannot reach ${service} service at ${url}. Make sure it is running.`,
			);
		}
		if (!resp.ok) {
			let detail = "";
			try {
				const body = await resp.json();
				detail = body.detail ?? body.error ?? body.message ?? "";
			} catch {
				detail = await resp.text().catch(() => "");
			}

			if (resp.status === 501) {
				throw new Error(
					detail || `${service} dependencies are not installed. Check the service logs.`,
				);
			}
			throw new Error(detail || `Failed to load model (HTTP ${resp.status})`);
		}
		const data = await resp.json().catch(() => ({}));

		// Wait briefly for the service to update its internal state
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Re-check health to confirm model is actually loaded
		const health = await checkServiceHealth(url);
		setServices((prev) => ({ ...prev, [service]: health }));
		return { ...data, verified: health.model_loaded === true };
	}, []);

	const verifyModel = useCallback(async (service: "whisper" | "tts" | "image"): Promise<{
		isLoaded: boolean;
		detail?: string;
	}> => {
		const url = SERVICE_URLS[service];
		const health = await checkServiceHealth(url);
		setServices((prev) => ({ ...prev, [service]: health }));

		if (health.status !== "running") {
			return { isLoaded: false, detail: "Service is not running" };
		}
		if (!health.model_loaded) {
			return {
				isLoaded: false,
				detail: health.model_installed === false
					? "Model dependencies are not installed. Try re-downloading."
					: "Model is not loaded. Try loading it again.",
			};
		}
		return { isLoaded: true };
	}, []);

	return { services, isChecking, checkAll, loadModel, verifyModel };
}
