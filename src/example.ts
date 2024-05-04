import { executeWorkflow, type WorkflowDescriptor } from "./api";

/**
 * To execute a workflow, you need to provide a workflow object and optional options.
 * Each task in the workflow is an object with an id, type, dependencies, and config.
 *
 * - The id is a unique identifier for the task in the workflow.
 * - The type is a string that identifies the task to be executed.
 * - The dependencies object maps the task dependency keys to the task ids.
 * - The config object contains the task configuration.
 *
 * A task with the given type must be registered with the engine.
 *
 * Dependencies can be a single dependency or a dependency group.
 *
 * - A single dependency is a key-value pair where the key is the dependency key and the value is the task id.
 * - A dependency group is a key-value pair where the key is the dependency key and the value is an array of task ids.
 *
 * The executeWorkflow function returns an async generator that yields intermediate and final workflow results.
 */

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

for await (const result of executeWorkflow(workflow, { signal })) {
  // Handle the result
  // Use `ac.abort()` to abort the workflow
}
