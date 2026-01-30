export abstract class StorageMigration {
	abstract from: number;
	abstract to: number;
	abstract run(): Promise<void>;
}
