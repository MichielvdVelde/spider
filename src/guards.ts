import type { ErrorResponse, ReadyMessage, Request, Response } from "./types";

/**
 * Check if the data is a ready message.
 * @param data - The data to check.
 * @returns Whether the data is a ready message.
 */
export function isReadyMessage(data: unknown): data is ReadyMessage {
  return typeof data === "object" && data !== null && "type" in data &&
    data.type === "ready";
}

/**
 * Check if the data is a request.
 * @param data - The data to check.
 * @param type - The expected type of the request.
 * @returns Whether the data is a request.
 */
export function isRequest<P = unknown>(
  data: unknown,
  type?: string,
): data is Request<P> {
  return typeof data === "object" && data !== null && "type" in data &&
    "id" in data && "input" in data && (!type || data.type === type);
}

/**
 * Check if the data is a response.
 * @template R - The expected response type.
 * @param data - The data to check.
 * @param type - The expected type of the response.
 * @param id - The expected ID of the response
 * @returns Whether the data is a response.
 */
export function isResponse<P = unknown>(
  data: unknown,
  type?: string,
  id?: string,
): data is Response<P> {
  return typeof data === "object" && data !== null && "type" in data &&
    "id" in data && (!type || data.type === type) && (!id || data.id === id);
}

/**
 * Check if the data is a success response.
 * @param data - The data to check.
 * @param type - The expected type of the response.
 * @param id - The expected ID of the response.
 */
export function isSuccessResponse<P = unknown>(
  data: unknown,
  type?: string,
  id?: string,
): data is Response<P> {
  return isResponse(data, type, id) && data.ok === true;
}

/**
 * Check if the data is a finish response.
 * @param data - The data to check.
 * @param type - The expected type of the response.
 * @param id - The expected ID of the response.
 */
export function isFinishResponse<P = unknown>(
  data: unknown,
  type?: string,
  id?: string,
): data is Response<P> {
  return isResponse(data, type, id) && data.finish === true;
}

/**
 * Check if the data is an error response.
 * @param data - The data to check.
 * @param type - The expected type of the response.
 * @param id - The expected ID of the response.
 */
export function isErrorResponse(
  data: unknown,
  type?: string,
  id?: string,
): data is ErrorResponse {
  return isResponse(data, type, id) && data.ok === false;
}
