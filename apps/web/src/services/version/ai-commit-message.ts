import type { TimelineDiff, ChangeSummary } from "@/types/version";

const AI_BACKEND_URL =
	typeof process !== "undefined"
		? process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8420"
		: "http://localhost:8420";

/**
 * Generate an AI-powered commit message from a diff.
 * Tries the local AI backend first, falls back to Ollama.
 */
export async function generateAICommitMessage(
	diff: TimelineDiff,
): Promise<string | null> {
	const prompt = buildPrompt(diff);

	// Try AI backend
	try {
		const message = await tryAIBackend(prompt);
		if (message) return message;
	} catch {
		// Fall through to Ollama
	}

	// Try Ollama
	try {
		const message = await tryOllama(prompt);
		if (message) return message;
	} catch {
		// Both failed
	}

	return null;
}

function buildPrompt(diff: TimelineDiff): string {
	const lines: string[] = [];
	lines.push("Generate a concise commit message (1-2 sentences) for a video editing project. Use video editing terminology, not technical JSON paths.");
	lines.push("");
	lines.push("Changes:");

	const { changeSummary } = diff;
	if (changeSummary.tracksAdded > 0) lines.push(`- Added ${changeSummary.tracksAdded} track(s)`);
	if (changeSummary.tracksRemoved > 0) lines.push(`- Removed ${changeSummary.tracksRemoved} track(s)`);
	if (changeSummary.elementsAdded > 0) lines.push(`- Added ${changeSummary.elementsAdded} element(s)`);
	if (changeSummary.elementsRemoved > 0) lines.push(`- Removed ${changeSummary.elementsRemoved} element(s)`);
	if (changeSummary.elementsModified > 0) lines.push(`- Modified ${changeSummary.elementsModified} element(s)`);

	// Include scene-level detail
	for (const scene of diff.scenes.added) {
		lines.push(`- Added scene "${scene.sceneName}"`);
	}
	for (const scene of diff.scenes.removed) {
		lines.push(`- Removed scene "${scene.sceneName}"`);
	}
	for (const scene of diff.scenes.modified) {
		for (const elem of scene.elementChanges.added) {
			lines.push(`- Added ${elem.elementType} "${elem.elementName}" to ${elem.trackName}`);
		}
		for (const elem of scene.elementChanges.removed) {
			lines.push(`- Removed ${elem.elementType} "${elem.elementName}"`);
		}
		for (const mod of scene.elementChanges.modified) {
			const summary = mod.changes.slice(0, 3).map((c) => c.humanReadable).join(", ");
			lines.push(`- Modified "${mod.elementName}": ${summary}`);
		}
	}

	lines.push("");
	lines.push("Respond with ONLY the commit message, nothing else. Keep it under 80 characters if possible.");

	return lines.join("\n");
}

async function tryAIBackend(prompt: string): Promise<string | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(`${AI_BACKEND_URL}/api/llm/chat/stream`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [{ role: "user", content: prompt }],
				stream: false,
			}),
			signal: controller.signal,
		});

		if (!response.ok) return null;

		const data = await response.json();
		const text = data?.response || data?.message?.content || data?.choices?.[0]?.message?.content;
		return text ? cleanCommitMessage(text) : null;
	} finally {
		clearTimeout(timeout);
	}
}

async function tryOllama(prompt: string): Promise<string | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);

	try {
		const response = await fetch("http://localhost:11434/api/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "llama3.2:1b",
				prompt,
				stream: false,
			}),
			signal: controller.signal,
		});

		if (!response.ok) return null;

		const data = await response.json();
		return data?.response ? cleanCommitMessage(data.response) : null;
	} finally {
		clearTimeout(timeout);
	}
}

function cleanCommitMessage(raw: string): string {
	return raw
		.replace(/^["']|["']$/g, "") // Remove surrounding quotes
		.replace(/^commit:\s*/i, "") // Remove "commit:" prefix
		.split("\n")[0] // Take first line only
		.trim()
		.slice(0, 200); // Cap length
}
