/**
 * A validation error. This error forms the base class for all validation errors.
 */
export class ValidationError extends Error {
  readonly name: string = "ValidationError";
  readonly dependency?: string;

  constructor(dependency?: string, message = "Validation failed") {
    super(message);
    this.dependency = dependency;
  }
}

/**
 * A cyclic dependency error.
 */
export class CyclicDependencyError extends ValidationError {
  readonly name: string = "CyclicDependencyError";
  /** The cyclic dependency path. */
  readonly path: string[];

  constructor(
    dependency: string,
    path: string[],
    message = "Cyclic dependency detected",
  ) {
    super(dependency, message);
    this.path = [...path, dependency];
  }
}

/**
 * A dependency not found error.
 */
export class DependencyNotFoundError extends ValidationError {
  readonly name: string = "DependencyNotFoundError";

  constructor(dependency: string, message = "Dependency not found") {
    super(dependency, message);
  }
}

/**
 * A duplicate task error.
 */
export class DuplicateTaskError extends ValidationError {
  readonly name: string = "DuplicateTaskError";

  constructor(dependency: string, message = "Duplicate task ID") {
    super(dependency, message);
  }
}
