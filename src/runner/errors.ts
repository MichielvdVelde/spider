import { BufferType, DependencyMap, Task, TaskConfig } from "../types";

/**
 * An error that occurred during task execution.
 * @internal
 */
export class TaskExecutionError extends Error {
  readonly name = "TaskExecutionError";

  /** The task that failed. */
  readonly task: Task<string, DependencyMap, BufferType, TaskConfig>;
  /** The errors that occurred. */
  readonly errors: Error[];

  constructor(
    task: Task<string, DependencyMap, BufferType, TaskConfig>,
    errors: Error[] = [],
    message = "Task execution failed",
  ) {
    super(message);

    this.task = task;
    this.errors = errors;
  }
}

/**
 * An error that occurred due to a missing or cyclic dependency.
 * @internal
 */
export class DependencyError extends Error {
  readonly name = "DependencyError";
  readonly key: string;

  constructor(key: string, message = "Dependency error") {
    super(message);

    this.key = key;
  }
}
