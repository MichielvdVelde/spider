import { AbortError } from "../errors";
import { isErrorResponse, isSuccessResponse } from "../guards";
import type {
  AbortFn,
  BufferType,
  DependencyMap,
  FinalTaskResult,
  FinalTaskResultPayload,
  FinalWorkflowResult,
  FinalWorkflowResultPayload,
  IntermediateTaskResult,
  IntermediateWorkflowResult,
  RejectFn,
  ResolveFn,
  Task,
  TaskConfig,
  TaskDescriptor,
} from "../types";
import { Deferred } from "../util";
import {
  execute,
  initializeDependencies,
  updateDependencies,
} from "./functions";
import { DependencyCounter } from "./lib/DependencyCounter";
import type { RunnerPool } from "./lib/RunnerPool";

/**
 * An executable workflow.
 */
export interface ExecutableWorkflow {
  /** The workflow ID. */
  id: string;
  /** The workflow tasks. */
  tasks: Map<string, Task<string, DependencyMap, BufferType, TaskConfig>>;
  /** The task descriptors. */
  taskDescriptors: Map<
    string,
    TaskDescriptor<string, DependencyMap, TaskConfig>
  >;
}

/**
 * Workflow execution options.
 */
export interface ExecuteWorkflowOptions {
  /** The task runner pool. */
  pool: RunnerPool;
  /** The abort signal. */
  signal?: AbortSignal;
}

/**
 * Execute a workflow.
 * @param workflow The workflow to execute.
 * @param options The workflow execution options.
 * @internal
 */
export async function* executeWorkflow(
  workflow: ExecutableWorkflow,
  options: ExecuteWorkflowOptions,
): AsyncGenerator<IntermediateWorkflowResult | FinalWorkflowResult> {
  const { tasks, taskDescriptors } = workflow;
  const { pool, signal } = options;
  const requestId = crypto.randomUUID();
  const taskKeySet: ReadonlySet<string> = new Set(tasks.keys());

  /** The results of each task. */
  const results = new Map<string, SharedArrayBuffer>();
  /** The readiness of each task. */
  const taskReadiness = new Map<string, Deferred<void>>();
  /** The number of dependencies for each task. */
  const dependencyCount = new DependencyCounter(taskKeySet);
  /** The tasks that depend on each task. */
  const dependents = new Map<string, Set<string>>();
  /** The tasks that are remaining to be executed. */
  const remainingTasks = new Set(taskKeySet);

  // Initialize dependency count and dependents
  for (const task of tasks.values()) {
    dependents.set(task.id, new Set());
    taskReadiness.set(task.id, new Deferred());

    // Initialize dependency count and dependents
    initializeDependencies(
      task,
      taskDescriptors.get(task.id)!,
      dependencyCount,
      dependents,
    );
  }

  // Ensure there are initial tasks
  const initialTasks = [...dependencyCount.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);

  if (!initialTasks.length) {
    throw new Error("Unable to execute workflow without initial tasks");
  }

  let deferredMessage:
    | Deferred<IntermediateTaskResult | FinalTaskResult>
    | null = new Deferred();

  const resolve: ResolveFn<IntermediateTaskResult | FinalTaskResult> = (
    result,
  ) => {
    const taskId = result.id;
    const deferred = deferredMessage;

    if (deferred === null) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Resolve called after workflow end");
      }

      return;
    }

    if (result.finish) {
      remainingTasks.delete(taskId);

      // Update dependencies
      updateDependencies(
        tasks.get(taskId)!,
        taskDescriptors.get(taskId)!,
        dependencyCount,
        dependents,
        taskReadiness,
      );

      // Update results
      results.set(taskId, result.payload.output);
    }

    // No new deferred message if all tasks are done
    deferredMessage = remainingTasks.size === 0 ? null : new Deferred();
    deferred.resolve(result);
  };

  const reject: RejectFn = (reason) => {
    const deferred = deferredMessage;
    deferredMessage = null;

    // Reject all remaining tasks
    for (const taskId of remainingTasks.values()) {
      taskReadiness.get(taskId)?.reject(reason);
    }

    deferred?.reject(reason);
  };

  /** Whether the workflow has been aborted. */
  let aborted = false;

  const abort: AbortFn = (reason) => {
    if (!aborted && deferredMessage) {
      aborted = true;

      // Reject all remaining tasks
      for (const taskId of remainingTasks.values()) {
        taskReadiness.get(taskId)?.reject(reason);
      }

      reject(new AggregateError([reason], "Workflow aborted"));
    }
  };

  // Start execution of all tasks
  Promise.allSettled(
    [...tasks.values()].map((task) =>
      execute(
        task,
        taskDescriptors.get(task.id)!,
        pool,
        taskReadiness,
        results,
        resolve,
        reject,
      )
    ),
  );

  // Wait for all messages to be dispatched
  while (deferredMessage !== null) {
    if (signal?.aborted) {
      abort(new AbortError("Workflow aborted"));
      break;
    }

    const message = await deferredMessage.promise;

    if (isErrorResponse(message)) {
      abort(new Error(message.error));
      break;
    }

    yield {
      id: requestId,
      type: "workflow:result",
      payload: {
        taskId: message.id,
        output: results.get(message.id)!,
      },
      finish: false,
    };
  }

  // Yield the results as a final message
  yield {
    id: requestId,
    type: "workflow:result",
    payload: {
      results: resultsMapToObj(results),
    },
    finish: true,
  };
}

/**
 * Convert a results map to an object.
 * @param results The results map.
 * @internal
 */
function resultsMapToObj(results: Map<string, SharedArrayBuffer>) {
  const obj: Record<string, SharedArrayBuffer> = {};

  for (const [key, value] of results.entries()) {
    obj[key] = value;
  }

  return obj;
}

/**
 * Task execution options.
 */
export interface ExecuteTaskOptions {
  /** The task runner pool. */
  pool: RunnerPool;
  /** The abort signal. */
  signal?: AbortSignal;
}

/**
 * Execute a task.
 * @param task The task to execute.
 * @param descriptor The task descriptor.
 * @param options The task execution options.
 */
export async function* executeTask(
  task: Task<string, DependencyMap, BufferType, TaskConfig>,
  descriptor: TaskDescriptor<string, DependencyMap, TaskConfig>,
  options: ExecuteTaskOptions,
): AsyncGenerator<IntermediateTaskResult | FinalTaskResult> {
  //
}
