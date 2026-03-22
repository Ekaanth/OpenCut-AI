/**
 * Client-side API key helpers.
 *
 * Keys are stored in localStorage by the Settings panel under "opencut-api-keys"
 * as a JSON object, and sent as custom headers to Next.js API routes.
 */

const STORAGE_KEY = "opencut-api-keys";

function getStoredKeys(): Record<string, string> {
	if (typeof window === "undefined") return {};
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch {
		return {};
	}
}

export function getApiKey(key: string): string | null {
	const keys = getStoredKeys();
	return keys[key] || null;
}

export function setApiKey(key: string, value: string): void {
	if (typeof window === "undefined") return;
	try {
		const keys = getStoredKeys();
		if (value) {
			keys[key] = value;
		} else {
			delete keys[key];
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
	} catch {
		// localStorage may be unavailable
	}
}

export function getFreesoundHeaders(): Record<string, string> {
	const apiKey = getApiKey("FREESOUND_API_KEY");
	if (apiKey) {
		return { "x-freesound-api-key": apiKey };
	}
	return {};
}
