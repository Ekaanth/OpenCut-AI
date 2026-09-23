import { describe, expect, test } from "bun:test";
import {
	generateShareToken,
	hashSharePassword,
	verifySharePassword,
	isShareLinkActive,
	SHARE_EXPIRATION_MS,
	formatShareUrl,
	shareUnlockCookieName,
} from "../share-utils";

describe("share tokens", () => {
	test("tokens are URL-safe and of the expected entropy", () => {
		for (let i = 0; i < 50; i++) {
			const token = generateShareToken();
			expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
		}
	});

	test("tokens do not collide in practice", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(generateShareToken());
		}
		expect(seen.size).toBe(1000);
	});
});

describe("share password hashing", () => {
	test("hash round-trips the correct password", () => {
		const stored = hashSharePassword("hunter2!");
		expect(verifySharePassword("hunter2!", stored)).toBe(true);
	});

	test("wrong password is rejected", () => {
		const stored = hashSharePassword("hunter2!");
		expect(verifySharePassword("hunter3!", stored)).toBe(false);
	});

	test("hashes are salted — same password hashes differently", () => {
		expect(hashSharePassword("same")).not.toBe(hashSharePassword("same"));
	});

	test("malformed stored hash is rejected, not thrown", () => {
		expect(verifySharePassword("x", "not-a-hash")).toBe(false);
		expect(verifySharePassword("x", "argon2$salt$hash")).toBe(false);
	});
});

describe("share link activity gate", () => {
	const now = new Date("2026-08-15T12:00:00Z");

	test("link with no expiry and no revocation is active", () => {
		expect(
			isShareLinkActive({ expiresAt: null, revokedAt: null, now }),
		).toEqual({ active: true });
	});

	test("expired link is reported as expired", () => {
		const result = isShareLinkActive({
			expiresAt: "2026-08-15T11:59:59Z",
			revokedAt: null,
			now,
		});
		expect(result.active).toBe(false);
		expect(result.reason).toBe("expired");
	});

	test("future expiry is still active", () => {
		expect(
			isShareLinkActive({
				expiresAt: "2026-08-16T00:00:00Z",
				revokedAt: null,
				now,
			}).active,
		).toBe(true);
	});

	test("revoked beats active expiry", () => {
		const result = isShareLinkActive({
			expiresAt: "2026-09-01T00:00:00Z",
			revokedAt: "2026-08-14T00:00:00Z",
			now,
		});
		expect(result.active).toBe(false);
		expect(result.reason).toBe("revoked");
	});

	test("accepts Date objects as well as ISO strings", () => {
		expect(
			isShareLinkActive({
				expiresAt: new Date("2026-08-15T11:00:00Z"),
				revokedAt: null,
				now,
			}).active,
		).toBe(false);
	});
});

describe("share helpers", () => {
	test("expiration table maps every supported option", () => {
		expect(SHARE_EXPIRATION_MS["1h"]).toBe(3_600_000);
		expect(SHARE_EXPIRATION_MS["24h"]).toBe(86_400_000);
		expect(SHARE_EXPIRATION_MS["7d"]).toBe(604_800_000);
		expect(SHARE_EXPIRATION_MS["30d"]).toBe(2_592_000_000);
		expect(SHARE_EXPIRATION_MS.never).toBeNull();
	});

	test("URLs embed the token under /shared", () => {
		expect(formatShareUrl("https://example.com", "abc123")).toBe(
			"https://example.com/shared/abc123",
		);
	});

	test("unlock cookie name is derived from the token prefix", () => {
		expect(shareUnlockCookieName("abcdefghijklmnop")).toBe(
			"share_unlock_abcdefghijkl",
		);
	});
});
