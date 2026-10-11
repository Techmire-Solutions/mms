import type { FastifyReply, FastifyRequest } from "fastify";
import type { RequestValidationError } from "@ts-rest/fastify";
import { replyValidationError } from "./zodRequest.js";

/**
 * Standard `requestValidationErrorHandler` for every ts-rest router.
 *
 * ts-rest defaults to the `'combined'` handler, which responds with
 * `{ pathParameterErrors, headerErrors, queryParameterErrors, bodyErrors }` —
 * a different shape from the rest of the API's `{ type, message }` envelope.
 * Registering this on every router keeps 400 responses consistent.
 *
 * Usage:
 *   await fastify.register(s.plugin(router), {
 *     requestValidationErrorHandler: standardRequestValidationErrorHandler,
 *   });
 */
export function standardRequestValidationErrorHandler(
  err: RequestValidationError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const zodError = err.body ?? err.query ?? err.pathParams ?? err.headers;
  const message = zodError instanceof Error ? zodError.message : err.message;
  void replyValidationError(reply, message);
}
