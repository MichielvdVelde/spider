/**
 * A deferred promise.
 * @internal
 */
export class Deferred<T = unknown, E = unknown> {
  #promise: Promise<T>;
  #resolve!: (value: T) => void;
  #reject!: (reason: E) => void;
  #settled = false;

  constructor() {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  /** Whether the promise has been settled. */
  get settled(): boolean {
    return this.#settled;
  }

  /** The underlying promise. */
  get promise(): Promise<T> {
    return this.#promise;
  }

  /**
   * Resolve the promise with the given value.
   * @param value The value to resolve the promise with.
   */
  resolve(value: T): void {
    if (this.#settled) {
      throw new Error("Deferred has already been settled");
    }

    this.#settled = true;
    this.#resolve(value);
  }

  /**
   * Reject the promise with the given reason.
   * @param reason The reason to reject the promise with.
   */
  reject(reason: E): void {
    if (this.#settled) {
      throw new Error("Deferred has already been settled");
    }

    this.#settled = true;
    this.#reject(reason);
  }
}
