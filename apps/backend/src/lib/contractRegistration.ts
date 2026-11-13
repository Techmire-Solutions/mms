import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { RequestValidationError } from "@ts-rest/fastify";
import { ResponseValidationError } from "@ts-rest/core";
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

/**
 * Error handler for ts-rest scopes.
 *
 * The ts-rest adapter installs its own handler, replacing the app's diagnostic
 * one — so every contract router installs this wrapper (contract/validation
 * errors keep their shapes; everything else is logged and answered with a
 * non-leaking 500 including the request id). Pair it with
 * `responseValidation: true` so a handler whose body drifted from its declared
 * schema fails loudly here instead of shipping a malformed payload.
 */
export function installContractErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof RequestValidationError) {
      return standardRequestValidationErrorHandler(error, request, reply);
    }
    if (error instanceof ResponseValidationError) {
      request.log.error({ err: error, url: request.url }, "Response failed its API contract");
      return reply.status(500).send({
        type: "contract_violation",
        message: "The server produced a response that does not match the API contract",
        requestId: request.id,
      });
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    const type = (error as { type?: unknown }).type;
    const violations = (error as { violations?: unknown }).violations;
    const message = error instanceof Error ? error.message : "Error";
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        type: typeof type === "string" && type ? type : "error",
        message,
        ...(Array.isArray(violations) ? { violations: violations.map(String) } : {}),
      });
    }
    request.log.error({ err: error, url: request.url }, "Contract route failed");
    return reply.status(500).send({
      type: "server_error",
      message: "Internal server error",
      requestId: request.id,
    });
  });
}
