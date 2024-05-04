import type { ReadyMessage } from "../types";
import { createMessageListener, dispatch } from "./functions";

// The global scope for the worker
const _self: SharedWorkerGlobalScope = self as any;

// Listen for connect events and handle messages
_self.addEventListener("connect", ({ ports }: MessageEvent<unknown>) => {
  const port = ports[0];
  const listener = createMessageListener(port);
  const removeListener = () => port.removeEventListener("message", listener);

  port.addEventListener("message", listener);
  port.addEventListener("error", removeListener, { once: true });

  port.start();

  // Dispatch a ready message to the port
  dispatch<ReadyMessage>(port, { type: "ready" });
});
