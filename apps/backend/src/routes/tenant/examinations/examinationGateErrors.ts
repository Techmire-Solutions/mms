import type { FastifyRequest } from "fastify";
import { NotFoundError, HttpDomainError } from "../../../lib/httpErrors.js";

/** Shared error mapper for the contract-based examination gate handlers. */
export function mapGateError(
  request: FastifyRequest,
  error: unknown,
  fallback: string,
): { status: number; body: { type: string; message: string } } {
  if (error instanceof HttpDomainError) {
    return { status: error.statusCode, body: { type: error.type, message: error.message } };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, body: { type: "not_found", message: error.message } };
  }
  request.log.error({ err: error, url: request.url }, fallback);
  return { status: 500, body: { type: "database_error", message: fallback } };
}
