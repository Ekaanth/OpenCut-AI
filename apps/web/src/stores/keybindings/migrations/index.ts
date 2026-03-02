import { v2ToV3 } from "./v2-to-v3";
import { v3ToV4 } from "./v3-to-v4";
import { v4ToV5 } from "./v4-to-v5";

type MigrationFn = ({ state }: { state: unknown }) => unknown;

const migrations: Record<number, MigrationFn> = {
	2: v2ToV3,
	3: v3ToV4,
	4: v4ToV5,
};

export const CURRENT_VERSION = 5;

export function runMigrations({
	state,
	fromVersion,
}: {
	state: unknown;
	fromVersion: number;
}): unknown {
	let current = state;
	for (let version = fromVersion; version < CURRENT_VERSION; version++) {
		const migrate = migrations[version];
		if (migrate) current = migrate({ state: current });
	}
	return current;
}
