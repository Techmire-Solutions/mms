import type { FastifyReply } from "fastify";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import {
  ContactPermissionError,
  ContactUniqueFieldError,
} from "../../../services/contactService.js";

export interface ParsedUniqueConstraintError {
  fieldId: string;
  tabId: string;
  message: string;
}

/**
 * Extracts fieldId, tabId, and localized message from Postgres 23505 unique constraint errors.
 */
export function parsePostgresUniqueError(error: unknown): ParsedUniqueConstraintError | null {
  const pgCode = (error as { code?: string })?.code;
  if (pgCode !== "23505") return null;

  const pgDetail = (error as { detail?: string })?.detail || "";
  const constraintName = (error as { constraint?: string })?.constraint || "";

  if (constraintName.includes("cnic") || pgDetail.includes("cnic")) {
    return { fieldId: "cnic", tabId: "basic", message: "CNIC must be unique per contact" };
  }
  if (constraintName.includes("phone") || pgDetail.includes("phone")) {
    return {
      fieldId: "number",
      tabId: "phones",
      message: "Phone number must be unique per contact",
    };
  }
  if (constraintName.includes("email") || pgDetail.includes("email")) {
    return {
      fieldId: "address",
      tabId: "emails",
      message: "Email address must be unique per contact",
    };
  }

  return { fieldId: "cnic", tabId: "basic", message: "Value must be unique per contact" };
}

export function handleContactWriteError(
  reply: FastifyReply,
  error: unknown,
  fallbackMessage = "Failed to save contact record",
): ReturnType<FastifyReply["status"]> {
  if (error instanceof ContactPermissionError) {
    return sendForbidden(reply, error.message);
  }
  if (error instanceof ContactUniqueFieldError) {
    return replyValidationError(reply, error.message, { errors: error.errors });
  }

  const uniqueError = parsePostgresUniqueError(error);
  if (uniqueError) {
    return replyValidationError(reply, uniqueError.message, {
      errors: [uniqueError],
    });
  }

  return sendDatabaseError(reply, fallbackMessage, error);
}

export function formatContactWriteError(error: unknown, fallbackMessage: string) {
  if (error instanceof ContactPermissionError) {
    return {
      status: 403 as const,
      body: { type: "forbidden" as const, message: error.message },
    };
  }

  if (
    error instanceof ContactUniqueFieldError ||
    (error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as { errors?: unknown[] }).errors))
  ) {
    const errWithErrors = error as { message: string; errors?: Record<string, unknown>[] };
    return {
      status: 400 as const,
      body: {
        type: "validation_error" as const,
        message: errWithErrors.message,
        errors: errWithErrors.errors,
      },
    };
  }

  const uniqueError = parsePostgresUniqueError(error);
  if (uniqueError) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error" as const,
        message: uniqueError.message,
        errors: [uniqueError],
      },
    };
  }

  const errObj = error as {
    message?: string;
    statusCode?: number;
    errors?: Record<string, unknown>[];
  };
  const msg = errObj?.message || fallbackMessage;
  const isValidation =
    errObj?.statusCode === 400 || /unique|conflict|already exists|validation/i.test(msg);
  if (isValidation) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error" as const,
        message: msg,
        ...(Array.isArray(errObj?.errors) ? { errors: errObj.errors } : {}),
      },
    };
  }

  return {
    status: 500 as const,
    body: { type: "database_error" as const, message: fallbackMessage },
  };
}
