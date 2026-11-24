import { isApiError } from "../api/errors";
import { isConflictError } from "../api/contractError";

export interface ApiFormErrorMapping {
  /** First message per field key, when the failure carried field-level validation. */
  fieldErrors?: Record<string, string>;
  /** Form-level message — always present for an `ApiError`, for any thrown `Error`. */
  message?: string;
  /** HTTP 409 (stale OCC token / duplicate) — callers show conflict-specific copy. */
  isConflict: boolean;
  /** Whether the failure was a structured `ApiError` (vs. a network/programming error). */
  isApiError: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeFieldKey(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.replace(/^body\./, "").trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
      .filter(Boolean)
      .join(".");
    return joined.length > 0 ? joined : null;
  }
  return null;
}

function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string");
    return typeof first === "string" ? first : null;
  }
  const record = asRecord(value);
  if (record) {
    if (typeof record.message === "string") return record.message;
    if (typeof record.msg === "string") return record.msg;
  }
  return null;
}

/** Flattens the known server validation payload shapes into field → message entries. */
function collectFieldErrors(payload: unknown, into: Record<string, string>, depth = 0): void {
  if (depth > 2 || payload == null) return;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const entry = asRecord(item);
      if (!entry) continue;
      const key = normalizeFieldKey(entry.field ?? entry.path ?? entry.name);
      const message = firstMessage(entry.message ?? entry.msg ?? entry.detail);
      if (key && message && !into[key]) into[key] = message;
    }
    return;
  }

  const record = asRecord(payload);
  if (!record) return;

  if (record.fieldErrors != null) {
    collectFieldErrors(record.fieldErrors, into, depth + 1);
    return;
  }
  if (record.errors != null) {
    collectFieldErrors(record.errors, into, depth + 1);
  }

  for (const [rawKey, value] of Object.entries(record)) {
    // Envelope keys are not fields.
    if (rawKey === "message" || rawKey === "type" || rawKey === "code" || rawKey === "requestId") {
      continue;
    }
    const key = normalizeFieldKey(rawKey);
    const message = firstMessage(value);
    if (key && message && !into[key]) into[key] = message;
  }
}

/**
 * Maps common API validation error payloads to field → message entries.
 *
 * Contract failures (`apiContractError`) carry `errors`; batch/domain failures
 * carry field lists under `details`. Both must reach the form — a toast-only
 * fallback silently drops the field the user has to fix.
 */
export function mapApiFormError(
  error: unknown,
  resolveMessage?: (message: string) => string,
): ApiFormErrorMapping {
  const translate = (message: string): string =>
    resolveMessage ? resolveMessage(message) : message;
  const conflict = isConflictError(error);

  if (!isApiError(error)) {
    const message = error instanceof Error ? error.message : "";
    return {
      message: message ? translate(message) : undefined,
      isConflict: conflict,
      isApiError: false,
    };
  }

  const fieldErrors: Record<string, string> = {};
  collectFieldErrors(error.errors, fieldErrors);
  if (Object.keys(fieldErrors).length === 0) {
    // `details` also carries domain context (`{ from, to }`, blocked student lists);
    // only its explicit validation envelopes may become field errors.
    const details = error.details;
    if (details && (details.fieldErrors != null || details.errors != null)) {
      collectFieldErrors(details, fieldErrors);
    }
  }

  for (const [key, value] of Object.entries(fieldErrors)) {
    fieldErrors[key] = translate(value);
  }

  return {
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    message: error.message ? translate(error.message) : undefined,
    isConflict: conflict,
    isApiError: true,
  };
}
