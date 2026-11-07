import type { FastifyInstance } from "fastify";
import { RequestValidationError } from "@ts-rest/fastify";
import { ResponseValidationError } from "@ts-rest/core";
import { standardRequestValidationErrorHandler } from "./contractRegistration.js";

/**
 * Error handler for ts-rest scopes. The adapter installs its own handler, replacing the app's
 * diagnostic one — so sessions routers install this wrapper (contract/validation errors keep their
 * shapes; everything else is logged and answered with a non-leaking 500 including the request id).
 */
export function installSessionsContractErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof RequestValidationError) {
      return standardRequestValidationErrorHandler(error, request, reply);
    }
    if (error instanceof ResponseValidationError) {
      request.log.error({ err: error, url: request.url }, "Sessions response failed its contract");
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
    request.log.error({ err: error, url: request.url }, "Sessions route failed");
    return reply.status(500).send({
      type: "server_error",
      message: "Internal server error",
      requestId: request.id,
    });
  });
}
