import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shareLinks } from "@/lib/db/schema-version-control";
import { isShareLinkActive, shareUnlockCookieName } from "./share-utils";

/**
 * Server-side helpers shared by the /api/sharing routes.
 * Every public route resolves the link from its token and runs the
 * same gate: active (not expired/revoked) + password unlocked.
 */

export type ShareLinkRow = typeof shareLinks.$inferSelect;

export async function getShareLinkByToken(
	token: string,
): Promise<ShareLinkRow | null> {
	const rows = await db
		.select()
		.from(shareLinks)
		.where(eq(shareLinks.token, token))
		.limit(1);
	return rows[0] ?? null;
}

/** Cookie value proving the reviewer unlocked this link: HMAC(token, passwordHash). */
export function unlockCookieValue(token: string, passwordHash: string): string {
	return createHmac("sha256", passwordHash)
		.update(token)
		.digest("base64url");
}

/**
 * Resolve the gate for a request. Returns a discriminated result —
 * routes translate { ok: false } into the matching response.
 */
export async function checkShareGate(
	link: ShareLinkRow,
): Promise<
	| { ok: true }
	| { ok: false; status: 404 | 403 | 401; error: string; passwordRequired?: boolean }
> {
	const active = isShareLinkActive(link);
	if (!active.active) {
		// Expired and revoked links are indistinguishable to strangers
		return { ok: false, status: 404, error: "Link not found" };
	}

	if (link.passwordHash) {
		const jar = await cookies();
		const cookie = jar.get(shareUnlockCookieName(link.token));
		if (!cookie || cookie.value !== unlockCookieValue(link.token, link.passwordHash)) {
			return {
				ok: false,
				status: 401,
				error: "Password required",
				passwordRequired: true,
			};
		}
	}

	return { ok: true };
}
