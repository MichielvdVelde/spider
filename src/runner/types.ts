import type {
  BufferType,
  DependencyMap,
  DependencyType,
  FromBufferType,
  Response,
  Task,
  TaskConfig,
  ToSharedArrayBuffer,
  ToSharedArrayBufferMap,
} from "../types";

/**
 * A task context.
 */
export interface Context<
  ID extends string,
  Deps extends DependencyMap,
  Config extends TaskConfig,
  Output extends BufferType,
> {
  /** The task ID. */
  id: ID;
  /** The task dependencies. */
  dependencies: ToSharedArrayBufferMap<Deps>;
  /** The task configuration. */
  config: Config;
  /** The task output buffer type. */
  output: FromBufferType<Output>;

  /**
   * Get a dependency by key.
   * @param key The dependency key.
   * @param index The dependency index. Only applicable for dependency groups.
   * @returns The dependency buffer.
   */
  get<T extends keyof Deps>(
    key: T,
    index?: number,
  ): ToSharedArrayBuffer<Deps[T]>;

  /**
   * Get a typed dependency by key.
   * @param key The dependency key.
   * @returns The dependency.
   */
  getTyped<T extends keyof Deps>(key: T): DependencyType<Deps, T>;

  /**
   * Dispatch a response.
   * @param response The response to dispatch.
   */
  dispatch: <P = unknown, R extends Response<P> = Response<P>>(
    response: R,
    transfer?: Transferable[],
  ) => void;
}

/**
 * A task runner.
 */
export type TaskRunner<
  ID extends string,
  Deps extends DependencyMap,
  Output extends BufferType,
  Config extends TaskConfig,
> = (context: Context<ID, Deps, Config, Output>) => Promise<SharedArrayBuffer>;

/**
 * A task run.
 */
export interface TaskRun<
  ID extends string,
  Deps extends DependencyMap,
  Output extends BufferType,
  Config extends TaskConfig,
> extends Task<ID, Deps, Output, Config> {
  /** The task runner. */
  runner: TaskRunner<ID, Deps, Output, Config>;
}
