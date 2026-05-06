export abstract class Command {
	abstract execute(): void;

	getDescription(): string {
		return this.constructor.name;
	}

	undo(): void {
		throw new Error("Undo not implemented for this command");
	}

	redo(): void {
		this.execute();
	}
}
