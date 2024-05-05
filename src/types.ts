/**
 * The worker type.
 *
 * Included because TypeScript does not support SharedWorker.
 * Should be replaced with SharedWorker when TypeScript supports it.
 */
export interface SharedWorker extends EventTarget {
  port: MessagePort;
  postMessage(message: any, transfer: Transferable[]): void;
}

/**
 * The engine type.
 */
export type Engine = SharedWorker;

/**
 * A buffer type is a typed array that can be used to store data.
 */
export type BufferType =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray
  | BigInt64Array
  | BigUint64Array;

/**
 * A buffer type as a string.
 * @template T The buffer type.
 */
export type FromBufferType<T extends BufferType> = T extends Float32Array
  ? "float32"
  : T extends Float64Array ? "float64"
  : T extends Int8Array ? "int8"
  : T extends Int16Array ? "int16"
  : T extends Int32Array ? "int32"
  : T extends Uint8Array ? "uint8"
  : T extends Uint16Array ? "uint16"
  : T extends Uint32Array ? "uint32"
  : T extends Uint8ClampedArray ? "uint8_clamped"
  : T extends BigInt64Array ? "bigint64"
  : T extends BigUint64Array ? "biguint64"
  : never;

/**
 * A string as a buffer type.
 * @template T The buffer type as a string.
 */
export type ToBufferType<T extends string> = T extends "float32" ? Float32Array
  : T extends "float64" ? Float64Array
  : T extends "int8" ? Int8Array
  : T extends "int16" ? Int16Array
  : T extends "int32" ? Int32Array
  : T extends "uint8" ? Uint8Array
  : T extends "uint16" ? Uint16Array
  : T extends "uint32" ? Uint32Array
  : T extends "uint8_clamped" ? Uint8ClampedArray
  : T extends "bigint64" ? BigInt64Array
  : T extends "biguint64" ? BigUint64Array
  : never;

/**
 * A base message. All messages should extend this type.
 */
export type BaseMessage = Record<string, unknown>;

/**
 * A message with a type.
 * @template Type The type of the message.
 */
export interface TypeMessage<Type extends string> extends BaseMessage {
  type: Type;
}

/**
 * A ready message.
 */
export interface ReadyMessage extends TypeMessage<"ready"> {
  // Reserved for future use
}

/**
 * A success message.
 */
export interface SuccessMessage extends TypeMessage<"success"> {
  ok: true;
}

/**
 * An error message.
 */
export interface ErrorMessage extends TypeMessage<string> {
  ok: false;
  error: string;
}

/**
 * A message with a payload.
 * @template P The payload type.
 */
export interface PayloadMessage<P = unknown> extends BaseMessage {
  payload: P;
}

/**
 * A resolve function.
 * @param value - The value to resolve.
 */
export type ResolveFn<T = unknown> = (
  value: T,
) => void;

/**
 * A reject function.
 * @param reason - The reason for the rejection.
 */
export type RejectFn<T = unknown> = (reason?: T) => void;

/**
 * A function to abort a workflow.
 * @param error - The error to abort with.
 */
export type AbortFn = (error: Error) => void;

/**
 * A task dependency.
 */
export type Dependency = BufferType;

/**
 * A group of task dependencies.
 */
export interface DependencyGroup {
  /** The buffer type. */
  type: BufferType;
  /**
   * The minimum number of dependencies required.
   * @default 0
   */
  min?: number;
  /**
   * The maximum number of dependencies allowed.
   * @default Infinity
   */
  max?: number;
}

/**
 * From a dependency group to a BufferType.
 */
export type FromDependencyGroup<T extends DependencyGroup> = FromBufferType<
  T["type"]
>;

/**
 * To a dependency group from a BufferType.
 */
export type ToDependencyGroup<T extends BufferType> = {
  type: T;
  min?: number;
  max?: number;
};

/**
 * A map of task dependencies.
 */
export type DependencyMap = Record<string, Dependency | DependencyGroup>;

/**
 * A dependency record.
 */
export type DependencyRecord = Record<
  string,
  SharedArrayBuffer | SharedArrayBuffer[]
>;

/**
 * To a shared array buffer from a dependency map.
 */
export type ToSharedArrayBufferMap<T extends DependencyMap> = {
  [K in keyof T]: T[K] extends Dependency ? SharedArrayBuffer
    : T[K] extends DependencyGroup ? SharedArrayBuffer[]
    : SharedArrayBuffer | SharedArrayBuffer[];
};

/**
 * To a shared array buffer from a dependency or dependency group.
 */
export type ToSharedArrayBuffer<T extends Dependency | DependencyGroup> =
  T extends Dependency ? SharedArrayBuffer
    : T extends DependencyGroup ? SharedArrayBuffer[]
    : SharedArrayBuffer | SharedArrayBuffer[];

/**
 * From a dependency map to a buffer type map.
 */
export type ToBufferTypeMap<T extends DependencyMap> = {
  [K in keyof T]: T[K] extends Dependency ? FromBufferType<T[K]>
    : T[K] extends DependencyGroup ? ToDependencyGroup<T[K]["type"]>
    : FromBufferType<BufferType> | ToDependencyGroup<BufferType>;
};

/**
 * To a buffer type map from a dependency map.
 */
export type ToBufferTypeMapString<T extends DependencyMap> = {
  [K in keyof T]: T[K] extends Dependency ? string
    : T[K] extends DependencyGroup ? string[]
    : string | string[];
};

/**
 * Get the dependency type from a dependency map for a key.
 */
export type DependencyType<T extends DependencyMap, K extends keyof T> =
  T[K] extends Dependency ? T[K]
    : T[K] extends DependencyGroup ? T[K]["type"][]
    : never;

/**
 * A task.
 */
export interface Task<
  ID extends string,
  Deps extends DependencyMap = DependencyMap,
  Output extends BufferType = BufferType,
  Config extends TaskConfig = TaskConfig,
> {
  /** Unique identifier for the task. */
  id: ID;
  /** Task type, identifies the task to be executed. */
  type: string;
  /** Dependencies required by the task. */
  dependencies: ToSharedArrayBufferMap<Deps>;
  /** Task configuration. */
  config: Config;
  /** Task output buffer type. */
  output: FromBufferType<Output>;
}

/**
 * The task configuration.
 */
export type TaskConfig = Record<string, unknown>;

/**
 * A task descriptor.
 */
export interface TaskDescriptor<
  Type extends string,
  Deps extends DependencyMap = DependencyMap,
  Config extends TaskConfig = TaskConfig,
> {
  /** Unique identifier for the task. */
  id: string;
  /** Task type, identifies the task to be executed. */
  type: Type;
  /** Dependencies required by the task. */
  dependencies: ToBufferTypeMapString<Deps> | null;
  /** Task configuration. */
  config: Config | null;
}

/**
 * A workflow.
 */
export interface WorkflowDescriptor {
  /** The workflow tasks. */
  tasks: TaskDescriptor<string, DependencyMap, TaskConfig>[];
  /** The workflow configuration. */
  config: WorkflowConfig | null;
}

/**
 * An execute workflow request.
 */
export interface ExecuteWorkflowRequest
  extends TypeMessage<"workflow:execute"> {
  /** The workflow ID. */
  id: string;
  /** The payload of the request. */
  payload: WorkflowDescriptor;
}

/**
 * An abort workflow message.
 */
export interface AbortWorkflowMessage
  extends TypeMessage<"workflow:abort">, PayloadMessage<string> {
  /** The workflow ID. */
  id: string;
}

/**
 * A workflow result.
 */
export interface BaseWorkflowResult<T extends string = string>
  extends TypeMessage<`workflow:${T}`> {
  /** The workflow ID. */
  id: string;
}

/**
 * An intermediate workflow result payload.
 */
export interface IntermediateWorkflowResultPayload {
  taskId: string;
  output: SharedArrayBuffer;
}

/**
 * A final workflow result payload.
 */
export interface FinalWorkflowResultPayload {
  results: Record<string, SharedArrayBuffer>;
}

/**
 * An intermediate workflow result.
 */
export interface IntermediateWorkflowResult
  extends
    BaseWorkflowResult,
    PayloadMessage<IntermediateWorkflowResultPayload> {
  finish: false;
}

/**
 * A final workflow result.
 */
export interface FinalWorkflowResult
  extends BaseWorkflowResult, PayloadMessage<FinalWorkflowResultPayload> {
  finish: true;
}

/**
 * A workflow result.
 */
export type WorkflowResult = IntermediateWorkflowResult | FinalWorkflowResult;

export interface BaseTaskResultPayload {
  taskId: string;
}

/**
 * A task result.
 */
export interface IntermediateTaskResultPayload extends BaseTaskResultPayload {
  //
}

/**
 * A final task result payload.
 */
export interface FinalTaskResultPayload extends BaseTaskResultPayload {
  output: SharedArrayBuffer;
}

export interface BaseTaskResult<T extends string = string>
  extends TypeMessage<`task:${T}`> {
  /** The result ID. */
  id: string;
}

/**
 * An intermediate task result.
 */
export interface IntermediateTaskResult
  extends BaseTaskResult, PayloadMessage<IntermediateTaskResultPayload> {
  finish: false;
}

/**
 * A final task result.
 */
export interface FinalTaskResult
  extends BaseTaskResult, PayloadMessage<FinalTaskResultPayload> {
  finish: true;
}

/**
 * A task result.
 */
export type TaskResult = IntermediateTaskResult | FinalTaskResult;

/**
 * A workflow configuration.
 */
export interface WorkflowConfig {
  // the configuration for the workflow
}

/**
 * Execute workflow options.
 */
export interface ExecuteWorkflowOptions {
  /** An abort signal to abort the workflow. */
  signal?: AbortSignal;
  /** Whether to skip validation of the workflow descriptor. */
  skipValidation?: boolean;
}

/**
 * A request to the worker.
 */
export interface Request<P = any> extends BaseMessage {
  /** The ID of the request. */
  id: string;
  /** The type of the request. */
  type: string;
  /** The payload of the request. */
  payload?: P;
}

/**
 * A payload request to the worker.
 */
export interface PayloadRequest<P = any> extends Request<P> {
  payload: P;
}

/**
 * A response from the worker.
 */
export interface Response<P = any> extends BaseMessage {
  /** The ID of the response. Must match the ID of the request. */
  id: string;
  /** The type of the response. */
  type: string;
  /** Whether the response was successful. */
  ok: boolean;
  /** The payload of the response. */
  payload?: P;
  /** An error message if the response was not successful. */
  error?: string;
  /** Whether the response is a finish response. */
  finish?: boolean;
}

/**
 * A success response from the worker.
 */
export interface SuccessResponse<P = any> extends Response<P> {
  ok: true;
}

/**
 * An error response from the worker.
 */
export interface ErrorResponse extends Response {
  ok: false;
  error: string;
}

/**
 * A payload response from the worker.
 */
export interface PayloadResponse<P = any> extends SuccessResponse<P> {
  payload: P;
}

/**
 * An intermediate response.
 */
export interface IntermediateResponse<P = any> extends Response<P> {
  finish: false;
}

/**
 * A finish response from the worker.
 */
export interface FinishResponse extends Response {
  finish: true;
}
