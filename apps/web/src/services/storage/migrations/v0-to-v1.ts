import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { StorageMigration } from "./base";
import { getProjectId, transformProjectV0ToV1 } from "./transformers/v0-to-v1";

export class V0toV1Migration extends StorageMigration {
	from = 0;
	to = 1;

	async run(): Promise<void> {
		const projectsAdapter = new IndexedDBAdapter<unknown>(
			"video-editor-projects",
			"projects",
			1,
		);
		const projects = await projectsAdapter.getAll();

		for (const project of projects) {
			if (typeof project !== "object" || project === null) {
				continue;
			}

			const result = transformProjectV0ToV1({
				project: project as Record<string, unknown>,
			});

			if (result.skipped) {
				continue;
			}

			const projectId = getProjectId({ project: result.project });
			if (!projectId) {
				continue;
			}

			await projectsAdapter.set(projectId, result.project);
		}
	}
}
