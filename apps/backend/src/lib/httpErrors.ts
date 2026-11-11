import type { FastifyReply } from "fastify";
import { logger } from "./logger.js";
import { pgErrorCode } from "./pgErrors.js";

export function sendForbidden(
  reply: FastifyReply,
  message = "Insufficient permissions",
): FastifyReply {
  return reply.status(403).send({ type: "forbidden", message });
}

export function sendUnauthorized(
  reply: FastifyReply,
  message = "Authentication is required",
  type = "auth_required",
): FastifyReply {
  return reply.status(401).send({ type, message });
}

export function sendNotFound(reply: FastifyReply, message = "Resource not found"): FastifyReply {
  return reply.status(404).send({ type: "not_found", message });
}

export function sendBadRequest(reply: FastifyReply, message = "Bad request"): FastifyReply {
  return reply.status(400).send({ type: "bad_request", message });
}

/** The shared `{ type, message }` envelope, plus optional structured context. */
export interface ErrorEnvelopeBody {
  type: string;
  message: string;
  /** Machine-readable reasons carried by domain errors (e.g. blocked transitions). */
  violations?: string[];
  /** Structured context (blocked students, transition endpoints, OCC token). */
  details?: Record<string, unknown>;
}

function defaultTypeForStatus(statusCode: number): string {
  return statusCode === 400
    ? "validation_error"
    : statusCode === 404
      ? "not_found"
      : statusCode === 409
        ? "conflict"
        : statusCode === 422
          ? "policy_violation"
          : "error";
}

/** Reads the optional structured context off an error, in the contract's envelope shape. */
export function errorEnvelopeExtras(
  error: unknown,
): Pick<ErrorEnvelopeBody, "violations" | "details"> {
  if (typeof error !== "object" || error === null) return {};
  const violations = (error as { violations?: unknown }).violations;
  const details = (error as { details?: unknown }).details;
  return {
    ...(Array.isArray(violations) ? { violations: violations.map((value) => String(value)) } : {}),
    ...(typeof details === "object" && details !== null
      ? { details: details as Record<string, unknown> }
      : {}),
  };
}

/**
 * Maps a domain error (anything carrying a 4xx `statusCode`) to the shared envelope.
 *
 * Preserves `violations`/`details` — the gate's blocked-student list and a lifecycle transition's
 * endpoints used to be dropped here even when the error carried them.
 */
export function mapDomainError(error: unknown): { status: number; body: ErrorEnvelopeBody } | null {
  if (typeof error !== "object" || error === null) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode !== "number" || statusCode < 400 || statusCode >= 500) return null;
  const type = (error as { type?: unknown }).type;
  return {
    status: statusCode,
    body: {
      type: typeof type === "string" && type ? type : defaultTypeForStatus(statusCode),
      message: error instanceof Error ? error.message : "Request rejected",
      ...errorEnvelopeExtras(error),
    },
  };
}

/** Domain errors thrown from use-cases with an explicit HTTP status + type. */
export function sendIfHttpDomainError(reply: FastifyReply, error: unknown): FastifyReply | null {
  const mapped = mapDomainError(error);
  return mapped ? reply.status(mapped.status).send(mapped.body) : null;
}

/**
 * Maps a PostgreSQL constraint failure to the status it actually is, instead of reporting every
 * database rejection as a 500. The exam paths rely on this: the marks-bounds trigger (`23514`), a
 * FK (`23503`), an oversized `varchar` (`22001`), a `numeric` overflow (`22003`) and the natural-key
 * unique index (`23505`) are all client-correctable, not server faults.
 */
export interface DatabaseConstraintResponse {
  status: number;
  type: string;
}

const PG_CONSTRAINT_RESPONSES: Record<string, DatabaseConstraintResponse> = {
  "23505": { status: 409, type: "conflict" },
  "23503": { status: 409, type: "reference_conflict" },
  "23514": { status: 400, type: "constraint_violation" },
  "22001": { status: 400, type: "value_too_long" },
  "22003": { status: 400, type: "value_out_of_range" },
  "22P02": { status: 400, type: "invalid_value" },
};

/** The client-correctable status/type for a PostgreSQL constraint code, if recognised. */
export function mapDatabaseErrorCode(
  code: string | undefined | null,
): DatabaseConstraintResponse | undefined {
  return code ? PG_CONSTRAINT_RESPONSES[code] : undefined;
}

/**
 * Maps a raw PostgreSQL constraint failure to the shared envelope.
 *
 * Contract/gate handlers run outside the generic route factories, so without this they report
 * `23505`/`23514`/`22003` as a 500. The route-specific message is not available here; a generic,
 * non-leaking message is used instead.
 */
export function mapConstraintError(
  error: unknown,
): { status: number; body: ErrorEnvelopeBody } | null {
  const mapped = mapDatabaseErrorCode(pgErrorCode(error));
  if (!mapped) return null;
  return {
    status: mapped.status,
    body: {
      type: mapped.type,
      message:
        mapped.status === 409
          ? "The request conflicts with the stored data"
          : "The request was rejected by a data constraint",
    },
  };
}

export function sendDatabaseError(
  reply: FastifyReply,
  message = "Database error occurred",
  cause?: unknown,
): FastifyReply {
  const code = cause === undefined ? undefined : pgErrorCode(cause);
  const mapped = mapDatabaseErrorCode(code);
  if (mapped) {
    logger.warn({ err: cause, code }, message);
    return reply.status(mapped.status).send({ type: mapped.type, message });
  }
  if (cause !== undefined) {
    // Log full cause server-side only — never echo DB internals to the client.
    logger.error({ err: cause }, message);
  }
  return reply.status(500).send({
    type: "database_error",
    message,
  });
}

export function sendConflict(reply: FastifyReply, message = "Conflict"): FastifyReply {
  return reply.status(409).send({ type: "conflict", message });
}

export function sendInvalidCurrentPassword(
  reply: FastifyReply,
  message = "Current password is incorrect",
): FastifyReply {
  return reply.status(401).send({ type: "invalid_current_password", message });
}

export function sendServiceUnavailable(
  reply: FastifyReply,
  message = "Service unavailable",
): FastifyReply {
  return reply.status(503).send({ type: "service_unavailable", message });
}

/** Base domain error with status code and error type contract. */
export class HttpDomainError extends Error {
  readonly statusCode: number;
  readonly type: string;
  /**
   * Structured context forwarded by `handleContractError`.
   *
   * `violations` is deliberately NOT declared here: several domain subclasses already expose a
   * readonly `violations` of their own, and redeclaring it on the base would force `override` on all
   * of them. The error handler reads both structurally, which is all the contract needs.
   */
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    type: string,
    message: string,
    extras?: { details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    if (extras?.details) this.details = extras.details;
  }
}

export class ConflictError extends HttpDomainError {
  constructor(message = "Conflict", type: string = "conflict", details?: Record<string, unknown>) {
    super(409, type, message, details ? { details } : undefined);
  }
}

/**
 * 422 — the request is well-formed but the domain policy refuses it (partial redemption, expired
 * card, value mismatch). State conflicts stay 409; payload shape problems stay 400.
 */
export class PolicyViolationError extends HttpDomainError {
  constructor(message: string, type = "policy_violation", details?: Record<string, unknown>) {
    super(422, type, message, details ? { details } : undefined);
  }
}

/**
 * A section/class has no free seat for the requested enrollment write.
 *
 * Separate from a generic conflict so the UI and the bulk-enroll path can tell
 * "the class is full" (retry later / waitlist) apart from "already enrolled".
 */
import { ENROLLMENT_ERROR_CODES } from "@mms/shared";

/** Codes the enrollments domain can emit (frontend branches on the union, not messages). */
export const ENROLLMENT_CLASS_FULL = ENROLLMENT_ERROR_CODES[0];
export const ENROLLMENT_ALREADY_ENROLLED = ENROLLMENT_ERROR_CODES[1];
export const ENROLLMENT_ROLL_NO_TAKEN = ENROLLMENT_ERROR_CODES[2];

export class SeatCapacityError extends HttpDomainError {
  constructor(
    message = "The class is full",
    readonly sectionId?: string,
    readonly seatsLeft?: number,
  ) {
    super(409, ENROLLMENT_CLASS_FULL, message);
  }
}

/** The student already holds a live enrollment in the target session. */
export class AlreadyEnrolledError extends ConflictError {
  constructor(message = "This student already has an active enrollment in this session") {
    super(message, ENROLLMENT_ALREADY_ENROLLED);
  }
}

/** The roll number is already taken inside the target section. */
export class RollNumberConflictError extends ConflictError {
  constructor(message = "This roll number is already used in the section") {
    super(message, ENROLLMENT_ROLL_NO_TAKEN);
  }
}

export class ValidationError extends HttpDomainError {
  constructor(message = "Validation error") {
    super(400, "validation_error", message);
  }
}

export class NotFoundError extends HttpDomainError {
  constructor(message = "Resource not found") {
    super(404, "not_found", message);
  }
}

export class ServiceUnavailableError extends HttpDomainError {
  constructor(message = "Service unavailable") {
    super(503, "service_unavailable", message);
  }
}
