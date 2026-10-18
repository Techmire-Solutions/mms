import type { FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { isForeignKeyViolation } from './pgErrors.js';

interface ContractErrorBody {
  type: string;
  message: string;
}

/**
 * Centralized error handling for ts-rest contract route handlers.
 *
 * Contract handlers run inside ts-rest's router (bypassing the Fastify error
 * pipeline), so handlers that simply `catch { return { status: 500, ... } }`
 * made production failures undiagnosable — no stack, no request correlation,
 * and Zod validation faults mislabeled as database errors. This is the single
 * seam for that path: it logs the error with request context, maps Zod
 * validation failures to a 400, and otherwise returns the caller's typed
 * fallback.
 *
 * Usage in a contract handler:
 *   try { ... } catch (error: unknown) {
 *     return handleContractError(request, error, {
 *       status: 500, body: { type: 'database_error', message: 'Failed to list accounts' },
 *     });
 *   }
 */
const CLIENT_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 429]);

export function handleContractError(
  request: FastifyRequest,
  error: unknown,
  fallback: { status: number; body: ContractErrorBody },
): { status: number; body: ContractErrorBody } {
  request.log.error({ err: error, url: request.url }, fallback.body?.message ?? 'Contract route failed');

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        type: 'validation_error',
        message: `Invalid request: ${error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ')}`,
      },
    };
  }

  // A restricting foreign key (e.g. a class still referenced by attendance) is a conflict, not a
  // server fault; never leak the constraint name or SQL.
  if (isForeignKeyViolation(error)) {
    return { status: 409, body: { type: 'conflict', message: 'This record is still referenced by other records' } };
  }

  // Preserve intentional domain statuses (HttpDomainError and friends) instead
  // of flattening every failure to the caller's 500 fallback.
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCode === 'number' && CLIENT_ERROR_STATUSES.has(statusCode)) {
    const type = (error as { type?: unknown }).type;
    return {
      status: statusCode,
      body: {
        type: typeof type === 'string' && type ? type : 'error',
        message: error instanceof Error ? error.message : fallback.body.message,
      },
    };
  }

  return { status: fallback.status, body: fallback.body };
}