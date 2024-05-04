import { isErrorResponse } from "../guards";
import type {
  BaseMessage,
  BufferType,
  DependencyMap,
  DependencyRecord,
  FinalTaskResult,
  IntermediateTaskResult,
  Task,
  TaskConfig,
  TaskDescriptor,
} from "../types";
import { Deferred } from "../util";
import { DependencyCounter } from "./lib/DependencyCounter";
import type { Runner, RunnerPool } from "./lib/RunnerPool";

/**
 * Create a message listener for the given port.
 *
 * @param port The port to create the listener for.
 * @internal
 */
export function createMessageListener(port: MessagePort) {
  return ({ data }: MessageEvent<unknown>) => {
    // TODO: Handle the message from the port.
  };
}

/**
 * Dispatch a message to the given port.
 *
 * @param port The port to dispatch the message to.
 * @param message The message to dispatch.
 * @param transfer The transferables to transfer.
 * @internal
 */
export function dispatch<T extends BaseMessage>(
  port: MessagePort,
  message: T,
  transfer?: Transferable[],
) {
  port.postMessage(message, transfer ? transfer : []);
}

/**
 * Initialize the dependencies for a task.
 *
 * This function makes sure that the dependency count and dependents are
 * initialized for the given task.
 *
 * @param task The task to initialize the dependency count for.
 * @param descriptor The task descriptor.
 * @param dependencyCount The dependency counter.
 * @param dependents The dependent tasks map.
 * @internal
 */
export function initializeDependencies(
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  dependencyCounter: DependencyCounter,
  dependents: Map<string, Set<string>>,
) {
  // Get the keys from the task descriptor so it takes into account the
  // dependencies that are not present in the task object
  const depKeys = descriptor.dependencies
    ? Object.keys(descriptor.dependencies)
    : [];

  for (const depKey of depKeys) {
    const dep = task.dependencies[depKey];

    if (!dep) {
      throw new Error(
        `Task "${task.id}" is missing a dependency for key "${depKey}"`,
      );
    } else if (Array.isArray(dep)) {
      dependencyCounter.increment(task.id, dep.length);

      for (let i = 0; i < dep.length; i++) {
        const depTaskId = descriptor.dependencies![depKey][i];
        dependents.get(depTaskId)!.add(task.id);
      }
    } else {
      dependencyCounter.increment(task.id);
      dependents.get(depKey)!.add(task.id);
    }
  }
}

/**
 * Update the dependencies for a task.
 *
 * This function updates the dependencies for a task by decrementing the
 * dependency count for the task and its dependents.
 *
 * @param task The task to update the dependencies for.
 * @param descriptor The task descriptor.
 * @param dependencyCounter The dependency counter.
 * @param dependents The dependent tasks map.
 * @param taskReadiness The task readiness map.
 * @internal
 */
export function updateDependencies(
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  dependencyCounter: DependencyCounter,
  dependents: Map<string, Set<string>>,
  taskReadiness: Map<string, Deferred<void>>,
) {
  const depKeys = descriptor.dependencies
    ? Object.keys(descriptor.dependencies)
    : [];

  for (const depKey of depKeys) {
    const dep = task.dependencies[depKey];

    if (Array.isArray(dep)) {
      for (let i = 0; i < dep.length; i++) {
        const depTaskId = descriptor.dependencies![depKey][i];
        const newCount = dependencyCounter.decrement(depTaskId);

        if (newCount === 0) {
          taskReadiness.get(depTaskId)!.resolve();
        }
      }
    } else {
      const newCount = dependencyCounter.decrement(depKey);

      if (newCount === 0) {
        // The task is ready to be executed
        taskReadiness.get(depKey)!.resolve();
      }
    }
  }

  for (const dependent of dependents.get(task.id)!) {
    const newCount = dependencyCounter.decrement(dependent);

    if (newCount === 0) {
      taskReadiness.get(dependent)!.resolve();
    }
  }
}

/**
 * Resolve the dependencies for a task.
 *
 * This function resolves the dependencies for a task by getting the results
 * from the results map.
 *
 * @param task The task to get the dependencies for.
 * @param descriptor The task descriptor.
 * @param results The workflow results.
 * @throws {Error} If a dependency is missing from the results.
 * @internal
 */
export function resolveDependencies(
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  results: Map<string, SharedArrayBuffer>,
): DependencyRecord {
  const depKeys = task.dependencies ? Object.keys(task.dependencies) : [];
  const dependencies: DependencyRecord = {};

  // Helper function to get a dependency or throw an error
  function getOrError(depTaskId: string, index?: number) {
    const value = results.get(depTaskId);

    if (!value) {
      const key = `${depTaskId}${index !== undefined ? `[${index}]` : ""}`;
      throw new Error(`Dependency "${key}" is missing from the results`);
    }

    return value;
  }

  for (const depKey of depKeys) {
    const dep = descriptor.dependencies?.[depKey];

    if (Array.isArray(dep)) {
      dependencies[depKey] = dep.map((depTaskId, index) =>
        getOrError(depTaskId, index)
      );
    } else {
      dependencies[depKey] = getOrError(depKey);
    }
  }

  return dependencies;
}

/**
 * Execute a task.
 *
 * This function executes a task by resolving the dependencies and executing
 * the task function.
 *
 * @param task The task to execute.
 * @param descriptor The task descriptor.
 * @param pool The runner pool.
 * @param taskReadiness The task readiness map.
 * @param results The workflow results.
 * @param resolve The resolve function.
 * @param reject The reject function.
 * @internal
 */
export async function execute(
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  pool: RunnerPool,
  taskReadiness: Map<string, Deferred<void>>,
  results: Map<string, SharedArrayBuffer>,
  resolve: (
    message: IntermediateTaskResult | FinalTaskResult,
    id: string,
  ) => void,
  reject: (reason: unknown) => void,
) {
  try {
    // Wait for dependencies to be ready
    await taskReadiness.get(task.id)!.promise;

    // Get the dependencies
    const dependencies = resolveDependencies(task, descriptor, results);

    // Execute the task in a runner
    await withRunner(pool, async (runner) => {
      try {
        const generator = executeTask(runner, task, descriptor, dependencies);

        for await (const message of generator) {
          if (isErrorResponse(message)) {
            reject(message);
          } else {
            resolve(message, task.id);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    throw new AggregateError([error], "Task execution failed");
  }
}

/**
 * Execute a task.
 * @param runner The task runner.
 * @param task The task to execute.
 * @param descriptor The task descriptor.
 * @param dependencies The task dependencies.
 * @internal
 */
export async function* executeTask(
  runner: Runner,
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  dependencies: Record<string, SharedArrayBuffer | SharedArrayBuffer[]>,
): AsyncGenerator<IntermediateTaskResult | FinalTaskResult> {
  // replace execute() with this function, self-contained to execute a task
  // will be part of the public API
}

/**
 * Execute the function with a runner from the pool.
 *
 * This function acquires a runner from the pool, executes the function with the
 * runner, and releases the runner back to the pool.
 *
 * @param pool - The runner pool.
 * @param fn - The function to execute.
 */
export async function withRunner(
  pool: RunnerPool,
  fn: (runner: Runner) => void | PromiseLike<void>,
) {
  const runner = await pool.acquire();

  try {
    await fn(runner);
  } finally {
    pool.release(runner);
  }
}
