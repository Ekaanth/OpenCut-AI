import { StorageMigration } from "./base";
import type { ProjectRecord } from "./transformers/types";
import { transformProjectV7ToV8 } from "./transformers/v7-to-v8";

export class V7toV8Migration extends StorageMigration {
	from = 7;
	to = 8;

	async transform(project: ProjectRecord): Promise<{
		project: ProjectRecord;
		skipped: boolean;
		reason?: string;
	}> {
		return transformProjectV7ToV8({ project });
	}
}
