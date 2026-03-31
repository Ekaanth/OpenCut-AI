import type { Commit, Branch, Tag } from "@/types/version";

export type WebhookEvent =
	| "commit"
	| "branch-create"
	| "branch-delete"
	| "merge"
	| "tag-create"
	| "export";

export interface WebhookConfig {
	id: string;
	url: string;
	events: WebhookEvent[];
	secret?: string;
	enabled: boolean;
}

export interface WebhookPayload {
	event: WebhookEvent;
	timestamp: string;
	project: {
		id: string;
		name: string;
	};
	data: Record<string, unknown>;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms

/**
 * Webhook manager for version control events.
 * Fires HTTP POST to configured URLs when events occur.
 */
export class WebhookManager {
	private configs: WebhookConfig[] = [];

	setConfigs(configs: WebhookConfig[]): void {
		this.configs = configs;
	}

	getConfigs(): WebhookConfig[] {
		return [...this.configs];
	}

	addConfig(config: WebhookConfig): void {
		this.configs.push(config);
	}

	removeConfig(id: string): void {
		this.configs = this.configs.filter((c) => c.id !== id);
	}

	/**
	 * Fire a webhook event to all configured URLs that subscribe to it.
	 */
	async fire(
		event: WebhookEvent,
		projectInfo: { id: string; name: string },
		data: Record<string, unknown>,
	): Promise<void> {
		const payload: WebhookPayload = {
			event,
			timestamp: new Date().toISOString(),
			project: projectInfo,
			data,
		};

		const targets = this.configs.filter(
			(c) => c.enabled && c.events.includes(event),
		);

		// Fire all webhooks concurrently (non-blocking)
		await Promise.allSettled(
			targets.map((config) => this.deliverWithRetry(config, payload)),
		);
	}

	private async deliverWithRetry(
		config: WebhookConfig,
		payload: WebhookPayload,
	): Promise<void> {
		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
				};

				if (config.secret) {
					const signature = await computeSignature(
						JSON.stringify(payload),
						config.secret,
					);
					headers["X-Webhook-Signature"] = signature;
				}

				const response = await fetch(config.url, {
					method: "POST",
					headers,
					body: JSON.stringify(payload),
				});

				if (response.ok) return;

				// Non-retryable errors
				if (response.status >= 400 && response.status < 500) {
					console.warn(
						`Webhook ${config.id} returned ${response.status}, not retrying`,
					);
					return;
				}
			} catch (error) {
				if (attempt < MAX_RETRIES) {
					await sleep(RETRY_DELAYS[attempt]);
				} else {
					console.error(
						`Webhook ${config.id} failed after ${MAX_RETRIES} retries:`,
						error,
					);
				}
			}
		}
	}

	// ─── Event Helpers ────────────────────────────────────────────────────

	async onCommit(
		projectInfo: { id: string; name: string },
		commit: Commit,
	): Promise<void> {
		await this.fire("commit", projectInfo, {
			commitId: commit.id,
			message: commit.message,
			author: commit.author,
			timestamp: commit.timestamp,
			changeSummary: commit.changeSummary,
		});
	}

	async onBranchCreate(
		projectInfo: { id: string; name: string },
		branch: Branch,
	): Promise<void> {
		await this.fire("branch-create", projectInfo, {
			branchName: branch.name,
			fromBranch: branch.createdFromBranch,
			fromCommit: branch.createdFromCommitId,
		});
	}

	async onBranchDelete(
		projectInfo: { id: string; name: string },
		branchName: string,
	): Promise<void> {
		await this.fire("branch-delete", projectInfo, { branchName });
	}

	async onMerge(
		projectInfo: { id: string; name: string },
		sourceBranch: string,
		targetBranch: string,
		commitId: string,
	): Promise<void> {
		await this.fire("merge", projectInfo, {
			sourceBranch,
			targetBranch,
			commitId,
		});
	}

	async onTagCreate(
		projectInfo: { id: string; name: string },
		tag: Tag,
	): Promise<void> {
		await this.fire("tag-create", projectInfo, {
			tagName: tag.name,
			commitId: tag.commitId,
			type: tag.type,
		});
	}
}

async function computeSignature(
	payload: string,
	secret: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
