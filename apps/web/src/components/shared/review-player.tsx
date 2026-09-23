"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewComment } from "@/lib/sharing/share-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Lightweight read-only player for shared snapshots.
 *
 * Deliberately independent of EditorCore — reviewers get a simple
 * sequential compositor (video/image/text layers positioned by their
 * normalized transform) with a scrubber, and comment at any frame.
 * Effects, masks, and transitions are approximated as plain layers.
 */

interface SnapshotElement {
	id: string;
	type: string;
	startTime: number;
	duration: number;
	trimStart?: number;
	mediaId?: string;
	hidden?: boolean;
	opacity?: number;
	content?: string;
	fontSize?: number;
	color?: string;
	background?: string;
	textAlign?: string;
	fontWeight?: string;
	transform?: {
		scale: number;
		position: { x: number; y: number };
		rotate: number;
	};
}

interface SnapshotTrack {
	id: string;
	type: string;
	elements: SnapshotElement[];
}

export interface SnapshotShape {
	scenes?: Array<{
		id: string;
		isMain?: boolean;
		name?: string;
		tracks?: SnapshotTrack[];
	}>;
}

export function ReviewPlayer({
	token,
	snapshot,
	media,
	projectName,
}: {
	token: string;
	snapshot: SnapshotShape;
	media: Record<string, string>;
	projectName: string;
}) {
	const elements = useMemo(() => {
		const scene =
			snapshot.scenes?.find((s) => s.isMain) ?? snapshot.scenes?.[0];
		const tracks = scene?.tracks ?? [];
		return tracks
			.flatMap((track) =>
				(track.elements ?? []).map((el) => ({ ...el, trackId: track.id })),
			)
			.filter((el) => !el.hidden)
			.sort((a, b) => a.startTime - b.startTime);
	}, [snapshot]);

	const totalDuration = useMemo(
		() =>
			Math.max(
				0.1,
				...elements.map((el) => el.startTime + el.duration),
			),
		[elements],
	);

	const [time, setTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [comments, setComments] = useState<ReviewComment[]>([]);
	const [name, setName] = useState("");
	const [body, setBody] = useState("");
	const [posting, setPosting] = useState(false);

	const rafRef = useRef<number>(0);
	const lastTickRef = useRef<number>(0);
	const mediaRefs = useRef(
		new Map<SnapshotElement, HTMLVideoElement | HTMLAudioElement>(),
	);

	const seek = useCallback((t: number) => {
		setTime(Math.min(Math.max(0, t), totalDuration));
	}, [totalDuration]);

	// ── Clock ──────────────────────────────────────────────────────────────
	useEffect(() => {
		if (!playing) return;
		lastTickRef.current = performance.now();
		const tick = (now: number) => {
			const dt = (now - lastTickRef.current) / 1000;
			lastTickRef.current = now;
			setTime((prev) => {
				const next = prev + dt;
				if (next >= totalDuration) {
					setPlaying(false);
					return totalDuration;
				}
				return next;
			});
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [playing, totalDuration]);

	// ── Keep every mounted media element in sync with the clock ────────────
	useEffect(() => {
		for (const [el, node] of mediaRefs.current) {
			const local = time - el.startTime + (el.trimStart ?? 0);
			if (time < el.startTime || time >= el.startTime + el.duration) {
				if (!node.paused) node.pause();
				continue;
			}
			if (Math.abs(node.currentTime - local) > 0.3) {
				node.currentTime = local;
			}
			if (playing && node.paused) {
				node.play().catch(() => undefined);
			} else if (!playing && !node.paused) {
				node.pause();
			}
		}
	}, [time, playing]);

	// ── Comments ───────────────────────────────────────────────────────────
	const loadComments = useCallback(async () => {
		const res = await fetch(`/api/sharing/${token}/comments`);
		if (res.ok) {
			const { comments } = (await res.json()) as { comments: ReviewComment[] };
			setComments(comments);
		}
	}, [token]);

	useEffect(() => {
		loadComments();
	}, [loadComments]);

	const submitComment = useCallback(async () => {
		const trimmedName = name.trim();
		const trimmedBody = body.trim();
		if (!trimmedName || !trimmedBody) {
			toast.error("Add your name and a comment");
			return;
		}
		setPosting(true);
		try {
			const res = await fetch(`/api/sharing/${token}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					authorName: trimmedName,
					body: trimmedBody,
					timeSeconds: Math.round(time * 100) / 100,
				}),
			});
			if (!res.ok) throw new Error("Failed to post comment");
			setBody("");
			await loadComments();
			toast.success("Comment added");
		} catch {
			toast.error("Could not post the comment");
		} finally {
			setPosting(false);
		}
	}, [name, body, time, token, loadComments]);

	const visible = (el: SnapshotElement) =>
		time >= el.startTime && time < el.startTime + el.duration;

	return (
		<div className="flex flex-col lg:flex-row gap-6">
			{/* Player column */}
			<div className="flex-1 min-w-0 flex flex-col gap-3">
				<div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
					{elements.map((el) => {
						if (!visible(el)) return null;
						if (el.type === "video" || el.type === "image") {
							const hash = el.mediaId ? media[el.mediaId] : undefined;
							if (!hash) {
								return (
									<Placeholder key={el.id} element={el} label="Media not uploaded" />
								);
							}
							const src = `/api/sharing/${token}/media/${hash}`;
							if (el.type === "image") {
								return (
									// biome-ignore lint/performance/noImgElement: token-scoped dynamic media URL — next/image cannot optimize it
									<img
										key={el.id}
										src={src}
										alt=""
										className="absolute max-w-none"
										style={layerStyle(el)}
									/>
								);
							}
							return (
								// biome-ignore lint/a11y/useMediaCaption: raw user footage has no caption tracks; text overlays render as layers below
								<video
									key={el.id}
									ref={(node) => {
										if (node) mediaRefs.current.set(el, node);
										else mediaRefs.current.delete(el);
									}}
									src={src}
									muted
									playsInline
									className="absolute max-w-none"
									style={layerStyle(el)}
								/>
							);
						}
						if (el.type === "audio") {
							const hash = el.mediaId ? media[el.mediaId] : undefined;
							if (!hash) return null;
							return (
								<audio
									key={el.id}
									ref={(node) => {
										if (node) mediaRefs.current.set(el, node);
										else mediaRefs.current.delete(el);
									}}
									src={`/api/sharing/${token}/media/${hash}`}
								 preload="auto"
								/>
							);
						}
						if (el.type === "text") {
							return (
								<div
									key={el.id}
									className="absolute max-w-[80%] whitespace-pre-wrap"
									style={{
										...layerStyle(el),
										fontSize: `${(el.fontSize ?? 24) / 1080 * 100}cqh`,
										color: el.color ?? "#fff",
										fontWeight: el.fontWeight === "bold" ? 700 : 400,
										textAlign: (el.textAlign as "left") ?? "center",
										containerType: "size",
									} as React.CSSProperties}
								>
									{el.content}
								</div>
							);
						}
						return null;
					})}
					{elements.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
							This snapshot is empty
						</div>
					)}
				</div>

				{/* Transport */}
				<div className="flex items-center gap-3">
					<Button size="sm" onClick={() => setPlaying((p) => !p)}>
						{playing ? "Pause" : "Play"}
					</Button>
					<div className="relative flex-1">
						<input
							type="range"
							min={0}
							max={totalDuration}
							step={0.05}
							value={time}
							onChange={(e) => seek(Number(e.target.value))}
							className="w-full accent-primary"
							aria-label="Seek"
						/>
						{comments.map((c) => (
							<button
								key={c.id}
								type="button"
								title={`${c.authorName}: ${c.body.slice(0, 60)}`}
								className={`absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded ${c.resolved ? "bg-muted-foreground/40" : "bg-primary"}`}
								style={{ left: `${(c.timeSeconds / totalDuration) * 100}%` }}
								onClick={() => seek(c.timeSeconds)}
							/>
						))}
					</div>
					<span className="font-mono text-xs text-muted-foreground tabular-nums">
						{formatTime(time)} / {formatTime(totalDuration)}
					</span>
				</div>
				<p className="text-xs text-muted-foreground">
					Reviewing “{projectName}” — comments anchor to the current time.
				</p>
			</div>

			{/* Comments column */}
			<div className="w-full lg:w-80 flex flex-col gap-3">
				<h2 className="text-sm font-semibold">
					Comments {comments.length > 0 && `(${comments.length})`}
				</h2>
				<div className="flex flex-col gap-2">
					<Input
						placeholder="Your name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="h-8"
					/>
					<textarea
						placeholder={`Comment at ${formatTime(time)}`}
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={3}
						className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
					/>
					<Button size="sm" onClick={submitComment} disabled={posting}>
						{posting ? "Posting…" : `Comment at ${formatTime(time)}`}
					</Button>
				</div>
				<div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
					{comments.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No comments yet — be the first.
						</p>
					) : (
						comments.map((c) => (
							<div
								key={c.id}
								className={`rounded-md border p-2 text-sm ${c.resolved ? "opacity-60" : ""}`}
							>
								<button
									type="button"
									className="font-mono text-xs text-primary hover:underline"
									onClick={() => seek(c.timeSeconds)}
								>
									{formatTime(c.timeSeconds)}
									{c.resolved ? " · resolved" : ""}
								</button>
								<p className="mt-1 whitespace-pre-wrap">{c.body}</p>
								<p className="mt-1 text-xs text-muted-foreground">{c.authorName}</p>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function layerStyle(el: SnapshotElement): React.CSSProperties {
	const t = el.transform;
	const x = t?.position?.x ?? 0.5;
	const y = t?.position?.y ?? 0.5;
	const scale = t?.scale ?? 1;
	return {
		left: `${x * 100}%`,
		top: `${y * 100}%`,
		transform: `translate(-50%, -50%) scale(${scale}) rotate(${t?.rotate ?? 0}deg)`,
		opacity: el.opacity ?? 1,
		width: el.type === "text" ? undefined : "80%",
		objectFit: "contain",
	};
}

function Placeholder({
	element: el,
	label,
}: {
	element: SnapshotElement;
	label: string;
}) {
	return (
		<div
			className="absolute flex items-center justify-center rounded bg-muted/20 text-[10px] text-white/40"
			style={layerStyle(el)}
		>
			{label}
		</div>
	);
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
