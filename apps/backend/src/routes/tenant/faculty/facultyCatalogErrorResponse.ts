import type { FastifyRequest } from "fastify";
import { isCatalogConflict } from "./facultyCatalogRouteAuth.js";

export interface CatalogErrorResponse {
  status: 400 | 404 | 409 | 500;
  body: {
    type: "validation_error" | "not_found" | "conflict" | "server_error";
    message: string;
  };
}

/**
 * Maps a thrown Faculty-catalog error onto its contract status code.
 *
 * Typed domain failures keep their 400/404/409 mapping. Anything else is an
 * infrastructure/DB failure: it must surface as 500 *and* be logged, instead of
 * masquerading as client input (a DB outage used to become "validation_error").
 */
export function catalogErrorResponse(
  error: unknown,
  request: FastifyRequest,
  logMessage: string,
  fallbackMessage: string,
): CatalogErrorResponse {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (isCatalogConflict(error)) return { status: 409, body: { type: "conflict", message } };

  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  if (statusCode === 400) return { status: 400, body: { type: "validation_error", message } };
  if (statusCode === 409) return { status: 409, body: { type: "conflict", message } };
  if (statusCode === 404 || message.includes("not found")) {
    return { status: 404, body: { type: "not_found", message } };
  }

  request.log.error({ err: error }, logMessage);
  return { status: 500, body: { type: "server_error", message: fallbackMessage } };
}
