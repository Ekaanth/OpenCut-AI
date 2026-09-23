import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers for share links. Server-only (node:crypto) except
 * isShareLinkActive / formatShareUrl which are also used from tests.
 */

export const SHARE_TOKEN_BYTES = 32;

/** Cryptographically random, URL-safe share token. */
export function generateShareToken(bytes = SHARE_TOKEN_BYTES): string {
	return randomBytes(bytes).toString("base64url");
}

/** scrypt hash — "scrypt$salt$hash", no external deps. */
export function hashSharePassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 64).toString("hex");
	return `scrypt$${salt}$${hash}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
	const parts = stored.split("$");
	if (parts.length !== 3 || parts[0] !== "scrypt") return false;
	const [, salt, expected] = parts;
	const actual = scryptSync(password, salt, 64);
	const expectedBuf = Buffer.from(expected, "hex");
	if (expectedBuf.length !== actual.length) return false;
	return timingSafeEqual(actual, expectedBuf);
}

/** Expiry is only enforced when set; revoked beats everything. */
export function isShareLinkActive(link: {
	expiresAt: Date | string | null;
	revokedAt: Date | string | null;
	now?: Date;
}): { active: boolean; reason?: "expired" | "revoked" } {
	const now = (link.now ?? new Date()).getTime();
	if (link.revokedAt && new Date(link.revokedAt).getTime() <= now) {
		return { active: false, reason: "revoked" };
	}
	if (link.expiresAt && new Date(link.expiresAt).getTime() <= now) {
		return { active: false, reason: "expired" };
	}
	return { active: true };
}

export const SHARE_EXPIRATION_MS: Record<string, number | null> = {
	"1h": 3_600_000,
	"24h": 86_400_000,
	"7d": 604_800_000,
	"30d": 2_592_000_000,
	never: null,
};

export function formatShareUrl(origin: string, token: string): string {
	return `${origin}/shared/${token}`;
}

export function shareUnlockCookieName(token: string): string {
	return `share_unlock_${token.slice(0, 12)}`;
}
