import type { FastifyReply } from "fastify";
import { logger } from "./logger.js";

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

/** Domain errors thrown from use-cases with an explicit HTTP status + type. */
export function sendIfHttpDomainError(reply: FastifyReply, error: unknown): FastifyReply | null {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    const statusCode = (error as { statusCode: number }).statusCode;
    const type =
      "type" in error && typeof (error as { type?: unknown }).type === "string"
        ? (error as { type: string }).type
        : statusCode === 400
          ? "validation_error"
          : statusCode === 404
            ? "not_found"
            : statusCode === 409
              ? "conflict"
              : "error";
    return reply.status(statusCode).send({
      type,
      message: error.message,
    });
  }
  return null;
}

export function sendDatabaseError(
  reply: FastifyReply,
  message = "Database error occurred",
  cause?: unknown,
): FastifyReply {
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
  constructor(message = "Conflict", type: string = "conflict") {
    super(409, type, message);
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
