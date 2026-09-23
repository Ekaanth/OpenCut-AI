"use client";

import { useCallback, useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEditor } from "@/hooks/use-editor";
import { useProjectSharing } from "@/hooks/use-project-sharing";
import type { ShareConfig, ShareLink, ReviewComment } from "@/lib/sharing/share-types";

/**
 * Share-for-review dialog: mint password/expiry-protected read-only links
 * pinned to the current commit, and triage reviewer comments
 * (jump to time, resolve/unresolve) without leaving the editor.
 */
export function ShareDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const {
		sharedLinks,
		isCreating,
		createShareLink,
		listShareLinks,
		revokeLink,
	} = useProjectSharing();

	const [tab, setTab] = useState<"links" | "comments">("links");
	const [expiration, setExpiration] =
		useState<ShareConfig["expiration"]>("7d");
	const [password, setPassword] = useState("");
	const [allowDownload, setAllowDownload] = useState(false);
	const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
	const [comments, setComments] = useState<ReviewComment[]>([]);
	const [loadingComments, setLoadingComments] = useState(false);

	useEffect(() => {
		if (open) {
			listShareLinks();
		}
	}, [open, listShareLinks]);

	const selectedLink = sharedLinks.find((l) => l.id === selectedLinkId) ?? null;

	const loadComments = useCallback(
		async (linkId: string) => {
			setLoadingComments(true);
			try {
				const res = await fetch(`/api/sharing/links/${linkId}/comments`);
				if (res.ok) {
					const { comments } = (await res.json()) as {
						comments: ReviewComment[];
					};
					setComments(comments);
				}
			} finally {
				setLoadingComments(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (tab === "comments") {
			const linkId =
				selectedLinkId ??
				sharedLinks.find((l) => (l.unresolvedCount ?? 0) > 0)?.id ??
				sharedLinks[0]?.id;
			if (linkId) {
				setSelectedLinkId(linkId);
				loadComments(linkId);
			} else {
				setComments([]);
			}
		}
	}, [tab, selectedLinkId, sharedLinks, loadComments]);

	const handleCreate = async () => {
		const link = await createShareLink({
			expiration,
			password: password.trim() ? password.trim() : undefined,
			allowDownload,
		});
		if (link) {
			setPassword("");
			await listShareLinks();
		}
	};

	const handleResolve = async (commentId: string, resolved: boolean) => {
		if (!selectedLink) return;
		const res = await fetch(`/api/sharing/links/${selectedLink.id}/comments`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ commentId, resolved }),
		});
		if (res.ok) {
			setComments((prev) =>
				prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)),
			);
		}
	};

	const unresolved = comments.filter((c) => !c.resolved).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Share for review</DialogTitle>
					<DialogDescription>
						Read-only review links pinned to the current commit. Reviewers
						don't need an account — they can leave frame-accurate comments.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-4 border-b pb-2 text-sm">
					<button
						type="button"
						className={tab === "links" ? "font-medium text-foreground" : "text-muted-foreground"}
						onClick={() => setTab("links")}
					>
						Links ({sharedLinks.filter((l) => !l.revoked).length})
					</button>
					<button
						type="button"
						className={tab === "comments" ? "font-medium text-foreground" : "text-muted-foreground"}
						onClick={() => setTab("comments")}
					>
						Comments{sharedLinks.length > 0 ? ` (${sharedLinks.reduce((n, l) => n + (l.unresolvedCount ?? 0), 0)})` : ""}
					</button>
				</div>

				{tab === "links" ? (
					<div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="share-expiration" className="text-xs">
									Expires
								</Label>
								<Select value={expiration} onValueChange={(v) => setExpiration(v as ShareConfig["expiration"])}>
									<SelectTrigger id="share-expiration">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1h">1 hour</SelectItem>
										<SelectItem value="24h">24 hours</SelectItem>
										<SelectItem value="7d">7 days</SelectItem>
										<SelectItem value="30d">30 days</SelectItem>
										<SelectItem value="never">Never</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="share-password" className="text-xs">
									Password (optional)
								</Label>
								<Input
									id="share-password"
									type="password"
									placeholder="None"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="h-8"
								/>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<Label htmlFor="share-download" className="text-xs">
								Allow media download
							</Label>
							<Switch
								id="share-download"
								checked={allowDownload}
								onCheckedChange={setAllowDownload}
							/>
						</div>
						<Button size="sm" onClick={handleCreate} disabled={isCreating}>
							{isCreating ? "Preparing snapshot…" : "Create review link"}
						</Button>

						{sharedLinks.length > 0 && (
							<div className="flex flex-col gap-1.5">
								{sharedLinks.map((link) => (
									<LinkRow key={link.id} link={link} onRevoke={revokeLink} />
								))}
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
						{sharedLinks.filter((l) => !l.revoked).length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Create a review link first — comments arrive here.
							</p>
						) : (
							<>
								<div className="flex flex-col gap-1.5">
									<Label className="text-xs">Link</Label>
									<Select
										value={selectedLink?.id ?? ""}
										onValueChange={(v) => {
											setSelectedLinkId(v);
											loadComments(v);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Choose a link" />
										</SelectTrigger>
										<SelectContent>
											{sharedLinks
												.filter((l) => !l.revoked)
												.map((l) => (
													<SelectItem key={l.id} value={l.id}>
														{l.createdAt.slice(0, 10)} — {l.views} views
														{l.unresolvedCount ? ` — ${l.unresolvedCount} open` : ""}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>

								{loadingComments ? (
									<p className="text-sm text-muted-foreground">Loading…</p>
								) : comments.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No comments on this link yet.
									</p>
								) : (
									<>
										<p className="text-xs text-muted-foreground">
											{unresolved} unresolved of {comments.length}
										</p>
										<div className="flex flex-col gap-1.5">
											{comments.map((comment) => (
												<div
													key={comment.id}
													className={`rounded-md border p-2 text-sm ${comment.resolved ? "opacity-60" : ""}`}
												>
													<div className="flex items-center justify-between gap-2">
														<button
															type="button"
															className="font-mono text-xs text-primary hover:underline"
															onClick={() =>
																editor.playback.seek({
																	time: comment.timeSeconds,
																})
															}
															title="Jump to this time"
														>
															{formatTimestamp(comment.timeSeconds)}
														</button>
														<button
															type="button"
															className="text-xs text-muted-foreground hover:text-foreground"
															onClick={() =>
																handleResolve(comment.id, !comment.resolved)
															}
														>
															{comment.resolved ? "Reopen" : "Resolve"}
														</button>
													</div>
													<p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{comment.authorName}
													</p>
												</div>
											))}
										</div>
									</>
								)}
							</>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function LinkRow({
	link,
	onRevoke,
}: {
	link: ShareLink;
	onRevoke: (id: string) => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div
			className={`flex items-center gap-2 rounded-md border p-2 ${link.revoked ? "opacity-50" : ""}`}
		>
			<div className="flex-1 min-w-0">
				<p className="truncate font-mono text-xs">{link.url}</p>
				<p className="text-xs text-muted-foreground">
					{link.revoked
						? "Revoked"
						: link.expiresAt
							? `Expires ${new Date(link.expiresAt).toLocaleString()}`
							: "Never expires"}
					{link.hasPassword ? " · password" : ""}
					{` · ${link.views} views`}
					{link.commentCount ? ` · ${link.commentCount} comments` : ""}
				</p>
			</div>
			{!link.revoked && (
				<>
					<Button
						size="sm"
						variant="ghost"
						className="h-7 text-xs"
						onClick={() => {
							navigator.clipboard.writeText(link.url).catch(() => undefined);
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						}}
					>
						{copied ? "Copied" : "Copy"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-7 text-xs text-destructive"
						onClick={() => onRevoke(link.id)}
					>
						Revoke
					</Button>
				</>
			)}
		</div>
	);
}

function formatTimestamp(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
