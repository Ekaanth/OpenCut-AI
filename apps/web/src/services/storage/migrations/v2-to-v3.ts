import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { StorageMigration } from "./base";
import { getProjectId, transformProjectV2ToV3 } from "./transformers/v2-to-v3";

export class V2toV3Migration extends StorageMigration {
	from = 2;
	to = 3;

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

			const result = transformProjectV2ToV3({
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
