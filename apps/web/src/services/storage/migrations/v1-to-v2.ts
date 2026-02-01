import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { StorageMigration } from "./base";
import { getProjectId, transformProjectV1ToV2 } from "./transformers/v1-to-v2";

export class V1toV2Migration extends StorageMigration {
	from = 1;
	to = 2;

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

			const result = transformProjectV1ToV2({
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
