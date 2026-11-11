export interface ApiErrorBody {
  type?: string;
  message?: string;
  /** Field-level validation issues (e.g. Contacts unique conflicts). */
  errors?: unknown;
  /** Stable machine-readable reason, e.g. module-gate denials (`MODULE_DISABLED`). */
  code?: string;
  /** Structured context carried by domain errors (e.g. the blocked-student list). */
  details?: Record<string, unknown>;
}

/** Structured API failure — map `type` to `t('errors.*')` in UI. */
export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly requestId?: string;
  readonly errors?: unknown;
  /** Seconds to wait before retrying (from `Retry-After`). */
  readonly retryAfterSeconds?: number;
  readonly code?: string;
  /**
   * Machine-readable context on a domain rejection — e.g. `details.students` for an ineligible
   * marks save, or `{ from, to }` for an illegal exam transition.
   */
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    type?: string,
    requestId?: string,
    errors?: unknown,
    retryAfterSeconds?: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.type =
      type ?? (status === 401 ? "auth_required" : status === 403 ? "forbidden" : "request_failed");
    this.requestId = requestId;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const asInt = Number.parseInt(header, 10);
  if (!Number.isNaN(asInt) && String(asInt) === header.trim()) {
    return Math.max(0, asInt);
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return undefined;
}
