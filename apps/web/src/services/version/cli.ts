/**
 * P5-10: CLI client for headless version control operations.
 * Communicates with the server API using an API token.
 *
 * Usage (from project root):
 *   npx tsx apps/web/src/services/version/cli.ts log --repo <repoId>
 *   npx tsx apps/web/src/services/version/cli.ts branch --repo <repoId>
 *   npx tsx apps/web/src/services/version/cli.ts diff --repo <repoId> --a <commitA> --b <commitB>
 */

const API_BASE = process.env.OPENCUT_API_URL || "http://localhost:3000/api/version-control";
const API_TOKEN = process.env.OPENCUT_API_TOKEN || "";

interface CLIOptions {
	command: string;
	repoId?: string;
	commitA?: string;
	commitB?: string;
	format?: "text" | "json";
	limit?: number;
}

function parseArgs(args: string[]): CLIOptions {
	const opts: CLIOptions = { command: args[0] || "help", format: "text" };

	for (let i = 1; i < args.length; i++) {
		switch (args[i]) {
			case "--repo":
				opts.repoId = args[++i];
				break;
			case "--a":
				opts.commitA = args[++i];
				break;
			case "--b":
				opts.commitB = args[++i];
				break;
			case "--format":
				opts.format = args[++i] as "text" | "json";
				break;
			case "--limit":
				opts.limit = parseInt(args[++i], 10);
				break;
		}
	}

	return opts;
}

async function apiFetch(path: string): Promise<unknown> {
	const response = await fetch(`${API_BASE}${path}`, {
		headers: {
			Authorization: `Bearer ${API_TOKEN}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`API error ${response.status}: ${await response.text()}`);
	}

	return response.json();
}

async function commandLog(opts: CLIOptions): Promise<void> {
	if (!opts.repoId) throw new Error("--repo required");

	const limit = opts.limit || 20;
	const commits = (await apiFetch(
		`/repos/${opts.repoId}/commits?limit=${limit}`,
	)) as Array<Record<string, unknown>>;

	if (opts.format === "json") {
		console.log(JSON.stringify(commits, null, 2));
		return;
	}

	for (const c of commits) {
		const date = new Date(c.createdAt as string).toLocaleDateString();
		const hash = (c.id as string).slice(0, 8);
		console.log(`${hash}  ${date}  ${c.message}`);
	}
}

async function commandBranch(opts: CLIOptions): Promise<void> {
	if (!opts.repoId) throw new Error("--repo required");

	const branches = (await apiFetch(
		`/repos/${opts.repoId}/branches`,
	)) as Array<Record<string, unknown>>;

	if (opts.format === "json") {
		console.log(JSON.stringify(branches, null, 2));
		return;
	}

	for (const b of branches) {
		console.log(`  ${b.name}  (head: ${(b.headCommitId as string).slice(0, 8)})`);
	}
}

async function commandTags(opts: CLIOptions): Promise<void> {
	if (!opts.repoId) throw new Error("--repo required");

	const tags = (await apiFetch(
		`/repos/${opts.repoId}/tags`,
	)) as Array<Record<string, unknown>>;

	if (opts.format === "json") {
		console.log(JSON.stringify(tags, null, 2));
		return;
	}

	for (const t of tags) {
		console.log(`  ${t.name}  → ${(t.commitId as string).slice(0, 8)}  [${t.type}]`);
	}
}

function printHelp(): void {
	console.log(`
opencut-vcs — CLI for OpenCut-AI version control

Commands:
  log       Show commit history        --repo <id> [--limit N] [--format json]
  branch    List branches              --repo <id> [--format json]
  tags      List tags                  --repo <id> [--format json]
  help      Show this help

Environment:
  OPENCUT_API_URL    API base URL (default: http://localhost:3000/api/version-control)
  OPENCUT_API_TOKEN  Authentication token
`);
}

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));

	switch (opts.command) {
		case "log":
			await commandLog(opts);
			break;
		case "branch":
			await commandBranch(opts);
			break;
		case "tags":
			await commandTags(opts);
			break;
		case "help":
		default:
			printHelp();
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
