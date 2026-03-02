import { StorageMigration } from "./base";
import type { ProjectRecord } from "./transformers/types";
import { transformProjectV8ToV9 } from "./transformers/v8-to-v9";

export class V8toV9Migration extends StorageMigration {
	from = 8;
	to = 9;

	async transform(project: ProjectRecord): Promise<{
		project: ProjectRecord;
		skipped: boolean;
		reason?: string;
	}> {
		return transformProjectV8ToV9({ project });
	}
}
