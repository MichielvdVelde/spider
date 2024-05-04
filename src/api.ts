import { AbortError } from "./errors";
import {
  attachEventHandlers,
  createEngine,
  createResponseMessageHandler,
  validateTaskGraph,
  waitForReady as baseWaitForReady,
} from "./functions";
import {
  AbortFn,
  AbortWorkflowMessage,
  type Engine,
  type ExecuteWorkflowOptions,
  ExecuteWorkflowRequest,
  type FinalWorkflowResult,
  type IntermediateWorkflowResult,
  RejectFn,
  Request,
  ResolveFn,
  type WorkflowDescriptor,
} from "./types";
import { Deferred } from "./util";

// Export the public types and functions
export type {
  BufferType,
  FromBufferType,
  TaskDescriptor,
  ToBufferType,
  WorkflowDescriptor,
} from "./types";

export {
  fromSharedArrayBuffer,
  getBufferType,
  validateTaskGraph,
} from "./functions";

/**
 * The engine for executing workflows.
 * @internal
 */
let engine: Engine | null = null;

/**
 * A promise that resolves when the engine is ready.
 * @internal
 */
let readyPromise: Promise<void> | null = null;

// if both engine and readyPromise are null, then the engine is not started
// if readyPromise is not null, then the engine is starting
// if readyPromise is null, and engine is not null, then the engine is started

/**
 * Get the engine.
 */
export function getEngine(): Engine | null {
  return engine;
}

/**
 * Check if the engine is started.
 */
export function started(): boolean {
  return engine !== null && readyPromise === null;
}

/**
 * Check if the engine is starting.
 */
export function starting(): boolean {
  return readyPromise !== null;
}

/**
 * Wait for the engine to be ready.
 *
 * If the engine is not started, the engine will be started.
 */
export async function waitForReady(): Promise<void> {
  if (!engine) {
    return start();
  } else if (readyPromise) {
    return readyPromise;
  }
}

/**
 * Start the engine.
 *
 * If the engine is already started, this function resolves immediately.
 * If the engine is starting, this function waits for the engine to be ready.
 *
 * @throws {AggregateError} - If the engine fails to start.
 * @returns A promise that resolves when the engine is ready.
 */
export async function start(): Promise<void> {
  if (engine) {
    return;
  } else if (readyPromise) {
    return readyPromise;
  }

  try {
    readyPromise = new Promise<void>(async (resolve, reject) => {
      try {
        const worker = createEngine();
        await baseWaitForReady(worker);
        engine = worker;
        attachEventHandlers(engine);
        resolve();
      } catch (error) {
        reject(new AggregateError([error], "Engine failed to start"));
      }
    });

    // Wait for the engine to be ready
    await readyPromise;

    // Handle errors while the engine is running
    const onError = (event: ErrorEvent) => {
      // The engine failed
      engine = null;

      if (process.env.NODE_ENV === "development") {
        console.error("Engine failed:", event.error);
      }
    };

    engine!.addEventListener("error", onError as EventListener, { once: true });
  } finally {
    readyPromise = null;
  }
}

/**
 * Execute a workflow.
 * @param workflow - The workflow to execute.
 * @param options - The options for executing the workflow.
 * @returns An async generator that yields the results of the workflow.
 */
export async function* executeWorkflow(
  workflow: WorkflowDescriptor,
  options?: ExecuteWorkflowOptions,
): AsyncGenerator<IntermediateWorkflowResult | FinalWorkflowResult> {
  const skipValidation = options?.skipValidation ?? false;

  if (!skipValidation) {
    validateTaskGraph(workflow.tasks);
  }

  // Make sure the engine is ready
  await waitForReady();

  /** The ID of the request. */
  const requestId = crypto.randomUUID();

  let deferredResult:
    | Deferred<IntermediateWorkflowResult | FinalWorkflowResult>
    | null = new Deferred();

  /**
   * Resolves the deferred result. Handles the finish flag by creating a new deferred result,
   * or setting the deferred result to null if the finish flag is true.
   * @internal
   */
  const resolve: ResolveFn<IntermediateWorkflowResult | FinalWorkflowResult> = (
    result,
  ) => {
    const deferred = deferredResult;

    if (!deferred) {
      return;
    } else if (result.finish) {
      deferredResult = null;
    } else {
      deferredResult = new Deferred();
    }

    deferred.resolve(result);
  };

  /**
   * Rejects the deferred result. Will also set the deferred result to null.
   * @internal
   */
  const reject: RejectFn = (reason) => {
    const deferred = deferredResult;
    deferredResult = null;
    deferred?.reject(reason);
  };

  /** Whether the workflow was aborted. */
  let aborted = false;

  /**
   * Aborts the workflow. Will reject the deferred result with the given error.
   * @internal
   */
  const abort: AbortFn = (error) => {
    if (!aborted) {
      aborted = true;

      dispatch<AbortWorkflowMessage>({
        id: requestId,
        type: "workflow:abort",
        payload: error.message,
      });
    }

    reject(error);
  };

  /** The signal for aborting the workflow. */
  const signal = options?.signal;

  // Setup message listening from the worker
  const handleMessage = createResponseMessageHandler(
    "workflow:execute",
    requestId,
    resolve,
    reject,
  );

  engine!.port.addEventListener("message", handleMessage);

  try {
    // Send the workflow to the worker for execution
    dispatch<ExecuteWorkflowRequest>({
      id: requestId,
      type: "workflow:execute",
      payload: workflow,
    });

    // Yield results until the workflow is finished
    while (deferredResult !== null) {
      if (signal?.aborted) {
        abort(new AbortError("Workflow aborted"));
      }

      const result = await deferredResult.promise;

      // Sanity check
      if (result === null) {
        throw new Error("Unexpected null result");
      }

      yield result;
    }
  } catch (error) {
    throw new AggregateError([error], "Workflow failed");
  } finally {
    engine?.port.removeEventListener("message", handleMessage);
  }
}

/**
 * Dispatches a message to the engine.
 * @param message - The message to send.
 * @param transfer - A list of Transferable objects.
 * @internal
 */
function dispatch<R extends Request>(
  message: R,
  transfer?: Transferable[],
): void {
  if (!engine) {
    throw new Error("The engine is not started.");
  } else if (!engine.port) {
    throw new Error("The engine port is not available.");
  }

  // Send the message to the engine
  engine.port.postMessage(message, transfer ? transfer : []);
}
