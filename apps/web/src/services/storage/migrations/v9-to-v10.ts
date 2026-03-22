import { StorageMigration } from "./base";
import type { ProjectRecord } from "./transformers/types";
import { transformProjectV9ToV10 } from "./transformers/v9-to-v10";

export class V9toV10Migration extends StorageMigration {
	from = 9;
	to = 10;

	async transform(project: ProjectRecord): Promise<{
		project: ProjectRecord;
		skipped: boolean;
		reason?: string;
	}> {
		return transformProjectV9ToV10({ project });
	}
}
