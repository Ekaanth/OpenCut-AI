import type { Command } from "@/lib/commands";
import { BatchCommand } from "@/lib/commands/batch-command";

export class CommandManager {
	private history: Command[] = [];
	private redoStack: Command[] = [];

	/**
	 * When non-null, we are inside a transaction.
	 * All commands are collected here instead of being pushed to history directly.
	 */
	private transactionBuffer: Command[] | null = null;

	execute({ command }: { command: Command }): Command {
		command.execute();

		if (this.transactionBuffer) {
			this.transactionBuffer.push(command);
		} else {
			this.history.push(command);
			this.redoStack = [];
		}

		return command;
	}

	push({ command }: { command: Command }): void {
		if (this.transactionBuffer) {
			this.transactionBuffer.push(command);
		} else {
			this.history.push(command);
			this.redoStack = [];
		}
	}

	undo(): void {
		if (this.history.length === 0) return;
		const command = this.history.pop();
		command?.undo();
		if (command) {
			this.redoStack.push(command);
		}
	}

	redo(): void {
		if (this.redoStack.length === 0) return;
		const command = this.redoStack.pop();
		command?.redo();
		if (command) {
			this.history.push(command);
		}
	}

	canUndo(): boolean {
		return this.history.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clear(): void {
		this.history = [];
		this.redoStack = [];
		this.transactionBuffer = null;
	}

	/**
	 * Start a transaction. All commands executed or pushed while
	 * a transaction is open are collected into a buffer.
	 * Call commitTransaction() to wrap them in a single BatchCommand.
	 */
	beginTransaction(): void {
		if (this.transactionBuffer) {
			// Nested transaction: just keep collecting into the same buffer
			return;
		}
		this.transactionBuffer = [];
	}

	/**
	 * Commit the current transaction. All buffered commands are wrapped
	 * in a BatchCommand and pushed to the history as a single entry.
	 * Returns the BatchCommand, or null if nothing was buffered.
	 */
	commitTransaction(): Command | null {
		const buffer = this.transactionBuffer;
		this.transactionBuffer = null;

		if (!buffer || buffer.length === 0) return null;

		const batch = buffer.length === 1 ? buffer[0] : new BatchCommand(buffer);
		this.history.push(batch);
		this.redoStack = [];
		return batch;
	}

	/**
	 * Discard the current transaction without pushing anything to history.
	 * The commands have already executed, so this only affects undo tracking.
	 */
	rollbackTransaction(): void {
		this.transactionBuffer = null;
	}

	isInTransaction(): boolean {
		return this.transactionBuffer !== null;
	}
}
