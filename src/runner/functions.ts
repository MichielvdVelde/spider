/// <reference lib="webworker" />

import { fromSharedArrayBuffer } from "../functions";
import type {
  BaseMessage,
  BufferType,
  DependencyMap,
  DependencyType,
  Task,
  TaskConfig,
  TaskDescriptor,
} from "../types";
import { DependencyError, TaskExecutionError } from "./errors";
import type { Context, TaskRun } from "./types";

/**
 * Dispatch a message to the engine.
 * @param message - The message to dispatch.
 * @param transfer - The transferable objects to transfer.
 * @internal
 */
export function dispatch<T extends BaseMessage>(
  message: T,
  transfer?: Transferable[],
): void {
  self.postMessage(message, transfer ? transfer : []);
}

/**
 * Create a new context for the given task.
 *
 * This function is used to create a new context for a task. The context
 * provides access to the task's dependencies, configuration, and output.
 *
 * @param descriptor - The task descriptor.
 * @param task - The task.
 * @internal
 */
export function createContext<
  ID extends string,
  Deps extends DependencyMap = DependencyMap,
  Output extends BufferType = BufferType,
  Config extends TaskConfig = TaskConfig,
>(
  descriptor: TaskDescriptor<string, Deps, Config>,
  task: Task<ID, Deps, Output, Config>,
): Context<ID, Deps, Config, Output> {
  return {
    id: task.id,
    dependencies: task.dependencies,
    config: task.config,
    output: task.output,
    get: (key) => {
      const dep = task.dependencies[key];

      if (!dep) {
        throw new DependencyError(
          key as string,
          `Dependency not found for key: "${key as string}"`,
        );
      }

      return dep;
    },
    getTyped: <K extends keyof Deps>(key: K, index?: number) => {
      const depType = descriptor.dependencies?.[key];
      const dep = task.dependencies[key];

      if (!depType || !dep) {
        throw new DependencyError(
          key as string,
          `Dependency type not found for key: "${key as string}"`,
        );
      }

      if (Array.isArray(dep)) {
        if (typeof index === "number" && index >= 0) {
          if (dep.length <= index) {
            throw new DependencyError(
              key as string,
              `Dependency index out of bounds for key: "${key as string}"`,
            );
          }

          return fromSharedArrayBuffer(
            depType,
            dep[index],
          ) as DependencyType<Deps, K>;
        } else {
          const mapper = (d: SharedArrayBuffer) =>
            fromSharedArrayBuffer(depType, d);

          return dep.map(mapper) as DependencyType<Deps, K>;
        }
      } else {
        if (typeof index === "number") {
          throw new DependencyError(
            key as string,
            `Dependency is not a group, cannot access by index for key: "${key as string}"`,
          );
        }

        return fromSharedArrayBuffer(depType, dep) as DependencyType<Deps, K>;
      }
    },
    dispatch,
  };
}

/**
 * Execute a task.
 * @param task - The task to execute.
 * @param runner - The task runner.
 * @internal
 */
export async function executeTask<
  ID extends string,
  Deps extends DependencyMap = DependencyMap,
  Output extends BufferType = BufferType,
  Config extends TaskConfig = TaskConfig,
>(
  descriptor: TaskDescriptor<string, Deps, Config>,
  run: TaskRun<ID, Deps, Output, Config>,
): Promise<void> {
  // Build the context
  const context = createContext(descriptor, run);

  try {
    await run.runner(context);
  } catch (error: any) {
    throw new TaskExecutionError(run, [error]);
  }
}
