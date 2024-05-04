/// <reference lib="webworker" />

import { isRequest } from "../guards";
import { ErrorMessage, ReadyMessage } from "../types";
import { dispatch } from "./functions";

// If the worker is busy, the request ID will be set to the ID of the request
let requestId: string | null = null;

// Add an event listener to handle messages from the main thread.
self.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
  if (isRequest(data)) {
    const idle = requestId === null;

    if (idle || requestId === data.id) {
      if (idle) {
        // Set the request ID
        requestId = data.id;
      }

      try {
        // TODO: Handle the request
      } finally {
        // Clear the request ID
        requestId = null;
      }
    } else {
      // Worker is busy
      dispatch<ErrorMessage>({
        ok: false,
        id: data.id,
        type: "error",
        error: "Worker is busy",
      });
      return;
    }
  } else {
    // Invalid message
    dispatch<ErrorMessage>({
      ok: false,
      id: (data as any).id,
      type: "error",
      error: "Invalid message",
    });
  }
});

// Send a ready message to the main thread.
dispatch<ReadyMessage>({ type: "ready" });
