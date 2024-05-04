import { isReadyMessage } from "../../guards";
import { Deferred } from "../../util";

/**
 * A runner is a worker that can execute tasks.
 */
export type Runner = Worker;

/**
 * The options for the runner pool.
 */
export interface RunnerPoolOptions {
  /**
   * The minimum number of runners to keep alive.
   * @default 1
   */
  min?: number;
  /**
   * The maximum number of runners to keep alive.
   * @default navigator.hardwareConcurrency ?? 1
   */
  max?: number;
}

/** The default options for the runner pool. */
const DEFAULT_OPTIONS: Required<RunnerPoolOptions> = {
  min: 1,
  max: navigator.hardwareConcurrency ?? 1,
};

/**
 * A pool of runners that can execute tasks.
 */
export class RunnerPool extends EventTarget {
  /** The runners in the pool. */
  #runners: Runner[] = [];
  /** The idle runners in the pool. */
  #idleRunners: Runner[] = [];
  /** The pending acquires in the pool. */
  #pending: Deferred<Runner>[] = [];
  /** The options for the runner pool. */
  #options: Required<RunnerPoolOptions>;

  /**
   * Creates a new runner pool.
   * @param options The options for the runner pool.
   * @param options.min The minimum number of runners to keep alive (default: 0).
   * @param options.max The maximum number of runners to create (default: `navigator.hardwareConcurrency ?? 1`).
   * @throws {TypeError} If the minimum number of runners is less than or equal to 0.
   * @throws {TypeError} If the maximum number of runners is less than or equal to 0.
   */
  constructor(options?: RunnerPoolOptions) {
    super();

    if (options?.min !== undefined && options.min <= 0) {
      throw new TypeError(
        "The minimum number of runners must be greater than 0",
      );
    } else if (options?.max !== undefined && options.max <= 0) {
      throw new TypeError(
        "The maximum number of runners must be greater than 0",
      );
    } else if (
      options?.min !== undefined && options.max !== undefined &&
      options.min > options.max
    ) {
      throw new Error(
        "The minimum number of runners cannot exceed the maximum number of runners",
      );
    }

    this.#options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (this.#options.min > 0) {
      for (let i = 0; i < this.#options.min; i++) {
        this.#createRunner(true).catch((error) => {
          this.dispatchEvent(new ErrorEvent("error", { error }));
        });
      }
    }
  }

  /** The minimum number of runners to keep alive. */
  get min(): number {
    return this.#options.min;
  }

  set min(value: number) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TypeError("The minimum number of runners must be an integer");
    } else if (value <= 0) {
      throw new TypeError(
        "The minimum number of runners must be greater than 0",
      );
    } else if (value > this.#options.max) {
      throw new TypeError(
        "The minimum number of runners cannot exceed the maximum number of runners",
      );
    }

    this.#options.min = value;

    // Create new runners if the minimum number of runners has increased
    for (let i = this.#runners.length; i < this.#options.min; i++) {
      this.#createRunner(true).catch((error) => {
        this.dispatchEvent(new ErrorEvent("error", { error }));
      });
    }

    // Terminate idle runners if the minimum number of runners has decreased
    if (this.#runners.length > this.#options.min) {
      this.#terminateIdleRunners();
    }
  }

  /** The maximum number of runners to create. */
  get max(): number {
    return this.#options.max;
  }

  set max(value: number) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TypeError("The maximum number of runners must be an integer");
    } else if (value <= 0) {
      throw new TypeError(
        "The maximum number of runners must be greater than 0",
      );
    } else if (value < this.#options.min) {
      throw new TypeError(
        "The maximum number of runners cannot be less than the minimum number of runners",
      );
    }

    this.#options.max = value;

    // Terminate idle runners if the maximum number of runners has decreased
    if (this.#runners.length > this.#options.max) {
      this.#terminateIdleRunners();
    }
  }

  /** The number of runners in the pool. */
  get size(): number {
    return this.#runners.length;
  }

  /** The number of idle runners in the pool. */
  get idle(): number {
    return this.#idleRunners.length;
  }

  /** The number of busy runners in the pool. */
  get busy(): number {
    return this.#runners.length - this.#idleRunners.length;
  }

  /** The number of pending acquires in the pool. */
  get pending(): number {
    return this.#pending.length;
  }

  /**
   * Acquires a runner from the pool. If there are no idle runners and the
   * maximum number of runners has not been reached, a new runner will be created.
   * Otherwise, the acquire will be pending until a runner becomes available.
   */
  async acquire(): Promise<Runner> {
    if (this.#idleRunners.length) {
      return this.#idleRunners.shift()!;
    } else if (this.#runners.length < this.#options.max) {
      return this.#createRunner(false);
    } else {
      const deferred = new Deferred<Runner>();
      this.#pending.push(deferred);
      return deferred.promise;
    }
  }

  /**
   * Releases a runner back to the pool. If there are any pending acquires, the
   * runner will be dispatched to the next pending acquire.
   * @param runner The runner to release.
   */
  release(runner: Runner): void {
    if (!this.#runners.includes(runner)) {
      throw new Error("The runner is not part of the pool");
    }

    this.#idleRunners.push(runner);
    this.#dispatchPending();
  }

  /**
   * Terminates all runners in the pool.
   */
  terminate(): void {
    for (const runner of this.#runners) {
      runner.terminate();
    }

    for (const deferred of this.#pending) {
      deferred.reject(new Error("The pool was terminated"));
    }

    this.#runners = [];
    this.#idleRunners = [];
    this.#pending = [];
  }

  /**
   * Terminates all idle runners in the pool.
   */
  #terminateIdleRunners(): void {
    for (const runner of this.#idleRunners) {
      runner.terminate();
    }

    this.#runners = this.#runners.filter((runner) =>
      !this.#idleRunners.includes(runner)
    );

    this.#idleRunners = [];
  }

  /**
   * Creates a new runner and adds it to the pool.
   * @param idle Whether the runner should be idle.
   */
  async #createRunner(idle: boolean): Promise<Runner> {
    return new Promise<Runner>((resolve, reject) => {
      const removeListeners = () => {
        runner.removeEventListener("message", onMessage);
        runner.removeEventListener("error", onError);
      };

      const onMessage = ({ data }: MessageEvent<unknown>) => {
        if (isReadyMessage(data)) {
          this.#runners.push(runner);

          if (idle) {
            this.#idleRunners.push(runner);
          }

          resolve(runner);
        } else {
          removeListeners();
          runner.terminate();

          reject(new Error("The runner failed to initialize"));
        }
      };

      const onError = (event: ErrorEvent) => {
        removeListeners();
        reject(event.error);
      };

      // Create a new runner
      const runner = new Worker(new URL("../../worker.ts", import.meta.url), {
        name: "spider-runner-worker",
        type: "module",
        credentials: "same-origin",
      });

      runner.addEventListener("message", onMessage);
      runner.addEventListener("error", onError, { once: true });
    });
  }

  /**
   * Dispatches a pending acquire to an idle runner if available.
   */
  #dispatchPending(): void {
    const count = Math.min(this.#pending.length, this.#idleRunners.length);

    if (count > 0) {
      const deferred = this.#pending.shift()!;
      const runner = this.#idleRunners.shift()!;

      deferred.resolve(runner);
    }
  }
}
