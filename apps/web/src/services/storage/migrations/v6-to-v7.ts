import { StorageMigration } from "./base";
import type { ProjectRecord } from "./transformers/types";
import { transformProjectV6ToV7 } from "./transformers/v6-to-v7";

export class V6toV7Migration extends StorageMigration {
	from = 6;
	to = 7;

	async transform(project: ProjectRecord): Promise<{
		project: ProjectRecord;
		skipped: boolean;
		reason?: string;
	}> {
		return transformProjectV6ToV7({ project });
	}
}
