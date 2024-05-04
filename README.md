# Spider - Task Workflow Engine for the Web

> 🚧 **This project is a work in progress. It is currently unusable.** 🚧

Spider is a TypeScript framework designed to orchestrate complex workflows where
tasks may depend on each other's outputs. It efficiently handles asynchronous
task execution, dependency management, and resource allocation, making it
suitable for environments that demand robust management of interdependent tasks.

## Features

- **Asynchronous Task Execution**: Executes tasks asynchronously, supporting
  I/O-bound or compute-intensive operations efficiently.
- **Dependency Management**: Define clear dependencies between tasks, either as
  singular dependencies or groups, to ensure tasks execute in the correct order.
- **Dynamic Task Resolution**: Tasks execute based on the readiness determined
  by their dependencies.
- **Resource Pooling**: Manages task execution concurrency through a runner
  pool, optimizing system resource usage.
- **Abort Capability**: Allows workflows to be aborted at any moment, providing
  control to stop execution gracefully.
- **Error Handling**: Manages task failures and propagates errors appropriately,
  ensuring the stability of the entire workflow.

## Usage

### Start the Engine

Spider's engine runs within a Shared Worker, ensuring that UI operations are not
blocked by heavy processing tasks. Being in a Shared Worker also means the
engine is shared across all tabs from the same origin. To start the engine,
simply call the `start` or `waitForReady` function (they are functionally
equivalent).

```ts
import { start, waitForReady } from "./api";

await start();

// or

await waitForReady();
```

This setup ensures that the engine is initialized and ready to manage the tasks
across multiple browser tabs without duplicating processes or consuming
excessive resources.

### Understanding Workflows

A workflow is a structured sequence of tasks that are designed to achieve a
specific outcome. Each workflow is a collection of tasks that can have
dependencies on the outputs of other tasks. This structured approach allows you
to define complex processes where the order of operations matters, ensuring that
each task is executed only after its prerequisites are met.

### Defining Tasks

Tasks are the fundamental units of work within a Spider workflow. Each task
represents a discrete operation or process that performs a specific function.
Tasks in Spider are defined with unique identifiers, types, dependencies, and
configuration options. The type of a task determines what the task does and how
it interacts with other tasks or external systems. Dependencies are used to
specify which tasks must be completed before the current task can start, thereby
enforcing the correct order of task execution within the workflow.

### Defining a Workflow

Workflows are defined using the `WorkflowDescriptor` type, encapsulating the
structure and dependencies of your tasks. Each task includes:

- **id**: Unique identifier for the task.
- **type**: Identifies the type of task to execute. Corresponding task types
  must be registered with the engine.
- **dependencies**: Maps dependency keys to task IDs. Dependencies can be
  individual tasks or groups of tasks.
- **config**: Task-specific configuration options.

A global configuration can also be set for the entire workflow through a
`config` object.

### Execution in Runners

To execute tasks, Spider utilizes runners that operate as Web Workers. Each
runner can execute one task at a time, retrieving task details from the engine,
handling their execution, and managing their lifecycles from initiation to
completion. Spider manages resource use, scales processing capabilities, and
maintains responsive user interfaces, even under heavy load conditions.

### Example Usage

```typescript
import { executeWorkflow, type WorkflowDescriptor } from "./api";

// Define a workflow
const workflow: WorkflowDescriptor = {
  tasks: [
    {
      id: "a",
      type: "task1",
      dependencies: null, // no dependencies
      config: null, // no configuration
    },
    {
      id: "b",
      type: "task2",
      dependencies: {
        a: "a", // a single dependency
        b: ["a"], // a dependency group
      },
      config: { // configuration
        key: "value",
      },
    },
  ],
  config: { // workflow configuration
    key: "value",
  },
};

const ac = new AbortController();
const signal = ac.signal;

// Execute the workflow
for await (const result of executeWorkflow(workflow, { signal })) {
  console.log("Workflow result:", result);
  console.log("Error:", result.error === true ? result.payload : null);
  console.log("Finished:", result.type === "workflow:result" && result.finish);
  // Use `ac.abort()` to abort the workflow if needed
}
```

### Handling Results

Spider’s `executeWorkflow` function returns an async generator that yields both
intermediate and final results of the workflow execution. This feature allows
you to handle results asynchronously as they become available, integrating
smoothly with different application architectures.

---

Made with ❤️. [MIT Licensed](LICENSE).
