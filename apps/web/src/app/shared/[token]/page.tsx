"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReviewPlayer, type SnapshotShape } from "@/components/shared/review-player";
import type { SharedProjectPayload } from "@/lib/sharing/share-types";

type LoadState =
	| { status: "loading" }
	| { status: "password" }
	| { status: "ready"; payload: SharedProjectPayload }
	| { status: "gone" }
	| { status: "error"; message: string };

export default function SharedReviewPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const [token, setToken] = useState<string | null>(null);
	const [state, setState] = useState<LoadState>({ status: "loading" });
	const [password, setPassword] = useState("");
	const [unlocking, setUnlocking] = useState(false);

	useEffect(() => {
		params.then(({ token }) => setToken(token));
	}, [params]);

	const load = useCallback(async (t: string) => {
		setState({ status: "loading" });
		try {
			const res = await fetch(`/api/sharing/${t}/project`);
			if (res.ok) {
				const payload = (await res.json()) as SharedProjectPayload;
				setState({ status: "ready", payload });
				return;
			}
			if (res.status === 401) {
				const { passwordRequired } = (await res.json().catch(() => ({}))) as {
					passwordRequired?: boolean;
				};
				if (passwordRequired) {
					setState({ status: "password" });
					return;
				}
			}
			if (res.status === 404) {
				setState({ status: "gone" });
				return;
			}
			if (res.status === 429) {
				setState({ status: "error", message: "Too many requests — try again shortly." });
				return;
			}
			setState({ status: "error", message: "This link could not be loaded." });
		} catch {
			setState({ status: "error", message: "Network error — try again." });
		}
	}, []);

	useEffect(() => {
		if (token) load(token);
	}, [token, load]);

	const [unlockError, setUnlockError] = useState(false);

	const unlock = useCallback(async () => {
		if (!token) return;
		setUnlocking(true);
		setUnlockError(false);
		try {
			const res = await fetch(`/api/sharing/${token}/unlock`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			if (res.ok) {
				await load(token);
			} else {
				setUnlockError(true);
				setPassword("");
			}
		} finally {
			setUnlocking(false);
		}
	}, [token, password, load]);

	return (
		<main className="min-h-dvh bg-background text-foreground">
			<header className="border-b">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
					<a href="/" className="text-sm font-semibold">
						OpenCut AI
					</a>
					<span className="text-xs text-muted-foreground">
						Read-only review — no account needed
					</span>
				</div>
			</header>

			<div className="mx-auto max-w-5xl px-4 py-8">
				{state.status === "loading" && (
					<p className="text-sm text-muted-foreground">Loading review…</p>
				)}

				{state.status === "gone" && (
					<div className="flex flex-col items-start gap-2">
						<h1 className="text-lg font-semibold">Link not found</h1>
						<p className="text-sm text-muted-foreground">
							This review link was revoked or has expired. Ask the owner for
							a fresh link.
						</p>
					</div>
				)}

				{state.status === "error" && (
					<p className="text-sm text-muted-foreground">{state.message}</p>
				)}

				{state.status === "password" && (
					<div className="mx-auto flex max-w-xs flex-col gap-3 py-16">
						<h1 className="text-lg font-semibold">Password required</h1>
						<p className="text-sm text-muted-foreground">
							Enter the password the owner shared with you.
						</p>
						<Input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") unlock();
							}}
						/>
						{unlockError && (
							<p className="text-xs text-destructive">Incorrect password</p>
						)}
						<Button onClick={unlock} disabled={unlocking}>
							{unlocking ? "Checking…" : "Unlock"}
						</Button>
					</div>
				)}

				{state.status === "ready" && (
					<ReviewPlayer
						token={token ?? ""}
						snapshot={state.payload.snapshot as SnapshotShape}
						media={state.payload.media}
						projectName={state.payload.link.projectName}
					/>
				)}
			</div>
		</main>
	);
}
