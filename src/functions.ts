import {
  CyclicDependencyError,
  DependencyNotFoundError,
  DuplicateTaskError,
} from "./errors";
import { isErrorResponse, isReadyMessage, isResponse } from "./guards";
import type {
  BufferType,
  Engine,
  FromBufferType,
  RejectFn,
  ResolveFn,
  TaskDescriptor,
  WorkflowDescriptor,
} from "./types";

/**
 * Create a new engine.
 * @internal
 */
export function createEngine(): Engine {
  // @ts-expect-error - Missing TypeScript type for SharedWorker.
  return new SharedWorker(new URL("./main/worker.ts", import.meta.url), {
    name: "subspace-main-worker",
    type: "module",
    credentials: "same-origin",
  });
}

/**
 * Attach event handlers to the engine.
 * @param engine - The engine to attach event handlers to.
 * @internal
 */
export function attachEventHandlers(
  engine: Engine,
): void {
  // TODO: Attach event handlers to the engine
}

/**
 * Create a response message handler.
 * @param type - The type of the message.
 * @param requestId - The ID of the request.
 * @param resolve - The resolve function.
 * @param reject - The reject function.
 * @internal
 */
export function createResponseMessageHandler(
  type: string, // NOTE: Make an array of types?
  requestId: string,
  resolve: ResolveFn,
  reject: RejectFn,
): (event: MessageEvent<unknown>) => void {
  return ({ data }: MessageEvent<unknown>) => {
    if (isResponse(data, type, requestId)) {
      if (isErrorResponse(data, type, requestId)) {
        reject(new Error(data.error));
      } else {
        resolve(data as any); // FIX: any
      }
    } else {
      reject(new Error("Unexpected message"));
    }
  };
}

/**
 * Wait for the engine to be ready.
 * @param engine - The engine to wait for.
 * @internal
 */
export function waitForReady(engine: Engine): Promise<void> {
  const { port } = engine;

  return new Promise<void>((resolve, reject) => {
    const removeListeners = () => {
      engine.port.removeEventListener("message", onMessage as EventListener);
      engine.port.removeEventListener("error", onError as EventListener);
    };

    const onMessage = ({ data }: MessageEvent<unknown>) => {
      removeListeners();

      if (isReadyMessage(data)) {
        resolve();
      } else {
        reject(new Error("Expected ready message"));
      }
    };

    const onError = (event: ErrorEvent) => {
      removeListeners();
      reject(new AggregateError([event.error], "Engine failed to start"));
    };

    port.addEventListener("message", onMessage as EventListener);
    port.addEventListener("error", onError as EventListener);
    port.start();
  });
}
/**
 * Get the type of a buffer.
 * @param buffer The buffer.
 * @returns The buffer type.
 * @internal
 */
export function getBufferType<B extends BufferType>(
  buffer: B,
): FromBufferType<B> {
  if (buffer instanceof Float32Array) {
    return "float32" as FromBufferType<B>;
  } else if (buffer instanceof Float64Array) {
    return "float64" as FromBufferType<B>;
  } else if (buffer instanceof Int8Array) {
    return "int8" as FromBufferType<B>;
  } else if (buffer instanceof Int16Array) {
    return "int16" as FromBufferType<B>;
  } else if (buffer instanceof Int32Array) {
    return "int32" as FromBufferType<B>;
  } else if (buffer instanceof Uint8Array) {
    return "uint8" as FromBufferType<B>;
  } else if (buffer instanceof Uint16Array) {
    return "uint16" as FromBufferType<B>;
  } else if (buffer instanceof Uint32Array) {
    return "uint32" as FromBufferType<B>;
  } else if (buffer instanceof Uint8ClampedArray) {
    return "uint8_clamped" as FromBufferType<B>;
  } else if (buffer instanceof BigInt64Array) {
    return "bigint64" as FromBufferType<B>;
  } else if (buffer instanceof BigUint64Array) {
    return "biguint64" as FromBufferType<B>;
  }

  throw new Error(
    `Unsupported buffer type: "${(buffer as any).constructor.name}"`,
  );
}

/**
 * Create a typed array from a shared array buffer.
 *
 * @template B The buffer type.
 * @template T The buffer type specifier.
 * @param type The buffer type.
 * @param length The length of the buffer.
 * @returns The typed array of the requested type.
 * @internal
 */
export function fromSharedArrayBuffer<
  B extends BufferType,
  T = FromBufferType<B>,
>(
  type: T,
  buffer: SharedArrayBuffer,
): B {
  switch (type) {
    case "float32":
      return new Float32Array(buffer) as B;
    case "float64":
      return new Float64Array(buffer) as B;
    case "int8":
      return new Int8Array(buffer) as B;
    case "int16":
      return new Int16Array(buffer) as B;
    case "int32":
      return new Int32Array(buffer) as B;
    case "uint8":
      return new Uint8Array(buffer) as B;
    case "uint16":
      return new Uint16Array(buffer) as B;
    case "uint32":
      return new Uint32Array(buffer) as B;
    case "uint8_clamped":
      return new Uint8ClampedArray(buffer) as B;
    case "bigint64":
      return new BigInt64Array(buffer) as B;
    case "biguint64":
      return new BigUint64Array(buffer) as B;
    default:
      throw new Error(`Unsupported buffer type: "${type}"`);
  }
}

/**
 * Validate a workflow descriptor.
 *
 * @param descriptor The workflow descriptor.
 * @throws {CyclicDependencyError} Thrown if a cyclic dependency is detected.
 * @throws {DependencyNotFoundError} Thrown if a dependency is not found.
 * @throws {DuplicateTaskError} Thrown if a duplicate task ID is found.
 */
export function validateWorkflowDescriptor(
  descriptor: WorkflowDescriptor,
): void {
  return validateTaskGraph(descriptor.tasks);
}

/**
 * Validate a task graph.
 *
 * @param tasks The task graph.
 * @throws {CyclicDependencyError} Thrown if a cyclic dependency is detected.
 * @throws {DependencyNotFoundError} Thrown if a dependency is not found.
 * @throws {DuplicateTaskError} Thrown if a duplicate task ID is found.
 */
export function validateTaskGraph(
  tasks: TaskDescriptor<string>[],
): void {
  const taskMap: Record<string, TaskDescriptor<string>> = {};
  const visited: Record<string, boolean> = {};
  const stack: string[] = [];

  function visit(id: string) {
    if (visited[id]) {
      throw new CyclicDependencyError(id, stack);
    }

    visited[id] = true;
    stack.push(id);

    const task = taskMap[id];
    const deps = task.dependencies;

    if (deps) {
      for (const key in deps) {
        const dep = deps[key];

        if (dep) {
          if (Array.isArray(dep)) {
            for (const d of dep) {
              if (typeof d === "string") {
                if (!taskMap[d]) {
                  throw new DependencyNotFoundError(d);
                }

                visit(d);
              }
            }
          } else {
            if (!taskMap[dep]) {
              throw new DependencyNotFoundError(dep);
            }

            visit(dep);
          }
        }
      }
    }

    stack.pop();
  }

  for (const task of tasks) {
    if (taskMap[task.id]) {
      throw new DuplicateTaskError(task.id);
    }

    taskMap[task.id] = task;
  }

  for (const task of tasks) {
    visit(task.id);
  }
}
