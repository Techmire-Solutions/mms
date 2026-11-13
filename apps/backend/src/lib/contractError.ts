import type { FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { isForeignKeyViolation } from "./pgErrors.js";
import { mapConstraintError } from "./httpErrors.js";

interface ContractErrorBody {
  type: string;
  message: string;
  /** Stable programmatic discriminator carried by domain errors. */
  code?: string;
  /** Per-row failures for a rejected batch (`attendance_batch_rejected`). */
  errors?: Array<{
    index: number;
    studentId: string;
    date: string;
    code: string;
    message: string;
  }>;
  /** Machine-readable reasons carried by domain errors (e.g. blocked session transitions). */
  violations?: string[];
  /** Structured context (e.g. `{ sectionId, seatsLeft }` for a full section). */
  details?: Record<string, unknown>;
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
const CLIENT_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 428, 429]);

export function handleContractError(
  request: FastifyRequest,
  error: unknown,
  fallback: { status: number; body: ContractErrorBody },
): { status: number; body: ContractErrorBody } {
  const requestedStatus = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof requestedStatus === "number" && CLIENT_ERROR_STATUSES.has(requestedStatus)) {
    // Expected rejections are not server faults: keep them out of the error budget.
    request.log.warn(
      { err: error, url: request.url, statusCode: requestedStatus },
      fallback.body?.message ?? "Contract route rejected",
    );
  } else {
    request.log.error(
      { err: error, url: request.url },
      fallback.body?.message ?? "Contract route failed",
    );
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        type: "validation_error",
        message: `Invalid request: ${error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      },
    };
  }

  // A restricting foreign key (e.g. a class still referenced by attendance) is a conflict, not a
  // server fault; never leak the constraint name or SQL.
  if (isForeignKeyViolation(error)) {
    return {
      status: 409,
      body: { type: "conflict", message: "This record is still referenced by other records" },
    };
  }

  // Any other PostgreSQL constraint failure (unique/natural key, check trigger, numeric range,
  // invalid text cast) is client-correctable: map it to 400/409 instead of the caller's 500.
  const constraintMapped = mapConstraintError(error);
  if (constraintMapped) {
    return { status: constraintMapped.status, body: constraintMapped.body };
  }

  // A response that does not match its declared contract is a server bug, not a client error.
  if ((error as { type?: unknown } | null)?.type === "contract_violation") {
    return {
      status: 500,
      body: {
        type: "contract_violation",
        message: error instanceof Error ? error.message : "Response contract violation",
      },
    };
  }

  // Preserve intentional domain statuses (HttpDomainError and friends) instead
  // of flattening every failure to the caller's 500 fallback.
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCode === "number" && CLIENT_ERROR_STATUSES.has(statusCode)) {
    const type = (error as { type?: unknown }).type;
    const violations = (error as { violations?: unknown }).violations;
    // `SeatCapacityError` carries the failing section/remaining seats; surface them so the
    // client can act instead of parsing the message.
    const sectionId = (error as { sectionId?: unknown }).sectionId;
    const seatsLeft = (error as { seatsLeft?: unknown }).seatsLeft;
    // Structured context carried by the error itself (e.g. per-row batch failures) plus the
    // seat-capacity pair, so the client can act without parsing the message.
    const carried = (error as { details?: unknown }).details;
    const details = {
      ...(typeof carried === "object" && carried !== null
        ? (carried as Record<string, unknown>)
        : {}),
      ...(typeof sectionId === "string" ? { sectionId } : {}),
      ...(typeof seatsLeft === "number" ? { seatsLeft } : {}),
    };
    const code = (error as { code?: unknown }).code;
    return {
      status: statusCode,
      body: {
        type: typeof type === "string" && type ? type : "error",
        message: error instanceof Error ? error.message : fallback.body.message,
        ...(typeof code === "string" && code ? { code } : {}),
        ...(Array.isArray(violations)
          ? { violations: violations.map((value) => String(value)) }
          : {}),
        ...(Object.keys(details).length > 0 ? { details } : {}),
      },
    };
  }

  return { status: fallback.status, body: fallback.body };
}
