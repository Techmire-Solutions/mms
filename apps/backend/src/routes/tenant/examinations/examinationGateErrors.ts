import type { FastifyRequest } from "fastify";
import {
  mapConstraintError,
  mapDomainError,
  type ErrorEnvelopeBody,
} from "../../../lib/httpErrors.js";

/**
 * Shared error mapper for the contract-based examination gate handlers.
 *
 * Domain errors keep their status, type and structured `details`/`violations` (the blocked-student
 * list), and raw PostgreSQL constraint failures are mapped to 400/409 instead of surfacing as a
 * 500 — those handlers run outside the generic route factories that do this mapping for the legacy
 * paths.
 */
export function mapGateError(
  request: FastifyRequest,
  error: unknown,
  fallback: string,
): { status: number; body: ErrorEnvelopeBody } {
  const domainMapped = mapDomainError(error);
  if (domainMapped) return domainMapped;
  const constraintMapped = mapConstraintError(error);
  if (constraintMapped) return constraintMapped;
  request.log.error({ err: error, url: request.url }, fallback);
  return { status: 500, body: { type: "database_error", message: fallback } };
}
