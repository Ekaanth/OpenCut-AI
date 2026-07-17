function fillRandomBytes(bytes: Uint8Array): void {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.getRandomValues === "function"
	) {
		crypto.getRandomValues(bytes);
		return;
	}

	// Last-resort fallback for non-secure / legacy contexts.
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
}

/** UUID v4 — works in insecure HTTP contexts where crypto.randomUUID is missing. */
export function generateUUID(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);
	fillRandomBytes(bytes);

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));

	return (
		hex.slice(0, 4).join("") +
		"-" +
		hex.slice(4, 6).join("") +
		"-" +
		hex.slice(6, 8).join("") +
		"-" +
		hex.slice(8, 10).join("") +
		"-" +
		hex.slice(10, 16).join("")
	);
}
