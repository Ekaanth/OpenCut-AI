import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getShareLinkByToken, unlockCookieValue } from "@/lib/sharing/share-server";
import { verifySharePassword, shareUnlockCookieName } from "@/lib/sharing/share-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const unlockSchema = z.object({ password: z.string().min(1).max(128) });

/** Public: verify a share-link password and set the unlock cookie. */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { token } = await params;
		const link = await getShareLinkByToken(token);
		if (!link) {
			return NextResponse.json({ error: "Link not found" }, { status: 404 });
		}

		const body = await request.json().catch(() => null);
		const parsed = unlockSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Password required" }, { status: 400 });
		}

		if (!link.passwordHash || !verifySharePassword(parsed.data.password, link.passwordHash)) {
			return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
		}

		const response = NextResponse.json({ ok: true });
		response.cookies.set({
			name: shareUnlockCookieName(token),
			value: unlockCookieValue(token, link.passwordHash),
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: `/shared/${token}`,
			maxAge: 60 * 60 * 24 * 7,
		});
		return response;
	} catch (error) {
		console.error("Error unlocking share link:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
