import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import type { ShareLink, ShareConfig } from "@/lib/sharing/share-types";
import { DEFAULT_SHARE_CONFIG } from "@/lib/sharing/share-types";
import { generateUUID } from "@/utils/id";
import { toast } from "sonner";

export function useProjectSharing() {
	const editor = useEditor();
	const [sharedLinks, setSharedLinks] = useState<ShareLink[]>([]);

	const createShareLink = useCallback(
		async (config: Partial<ShareConfig> = {}) => {
			const cfg = { ...DEFAULT_SHARE_CONFIG, ...config };
			const projectId = editor.project.getActive().metadata.id;

			const expirationMs: Record<string, number | null> = {
				"1h": Date.now() + 3600000,
				"24h": Date.now() + 86400000,
				"7d": Date.now() + 604800000,
				"30d": Date.now() + 2592000000,
				never: null,
			};

			const link: ShareLink = {
				id: generateUUID(),
				url: `${window.location.origin}/shared/${projectId}-${generateUUID().slice(0, 8)}`,
				expiresAt: expirationMs[cfg.expiration],
				password: cfg.password,
				allowDownload: cfg.allowDownload,
				allowEdit: cfg.allowEdit,
				views: 0,
				createdAt: Date.now(),
			};

			setSharedLinks((prev) => [...prev, link]);

			await navigator.clipboard.writeText(link.url);
			toast.success("Share link copied to clipboard");

			return link;
		},
		[editor],
	);

	const revokeLink = useCallback((linkId: string) => {
		setSharedLinks((prev) => prev.filter((l) => l.id !== linkId));
		toast.success("Share link revoked");
	}, []);

	return { sharedLinks, createShareLink, revokeLink };
}
