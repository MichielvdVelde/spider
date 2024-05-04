/**
 * A class to keep track of the dependency count of tasks.
 */
export class DependencyCounter {
  #counts = new Map<string, number>();

  /**
   * Set the count for a task.
   *
   * @param taskId The task ID.
   * @param count The count.
   * @returns The count.
   */
  set(taskId: string, count: number): number {
    this.#counts.set(taskId, count);
    return count;
  }

  /**
   * Increment the count for a task.
   *
   * @param taskId The task ID.
   * @param count The count to increment by.
   * @returns The new count.
   */
  increment(taskId: string, count = 1): number {
    const prevCount = this.#counts.get(taskId) ?? 0;
    const newCount = prevCount + count;

    this.#counts.set(taskId, newCount);
    return newCount;
  }

  /**
   * Decrement the count for a task.
   *
   * @param taskId The task ID.
   * @param count The count to decrement by.
   * @returns The new count.
   */
  decrement(taskId: string): number {
    const prevCount = this.#counts.get(taskId) ?? 0;
    const newCount = prevCount - 1;

    if (newCount < 0) {
      throw new Error(`Dependency count for task ${taskId} is already zero`);
    }

    this.#counts.set(taskId, newCount - 1);
    return newCount;
  }

  /**
   * Get the count for a task.
   * @param taskId The task ID.
   * @returns The count.
   */
  get(taskId: string): number {
    return this.#counts.get(taskId) ?? 0;
  }

  /**
   * Check if the count for a task is zero.
   * @param taskId The task ID.
   * @returns `true` if the count is zero, otherwise `false`.
   */
  isZero(taskId: string): boolean {
    return this.get(taskId) === 0;
  }

  /**
   * Get the entries of the dependency count.
   * @returns The entries of the dependency count.
   */
  entries(): IterableIterator<[string, number]> {
    return this.#counts.entries();
  }

  /**
   * Get the keys of the dependency count.
   * @returns The keys of the dependency count.
   */
  keys(): IterableIterator<string> {
    return this.#counts.keys();
  }
}
