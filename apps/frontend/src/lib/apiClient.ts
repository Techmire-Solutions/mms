import {
  API_REFRESH_PATH,
  executeFetchWithTimeout,
  type FetchWithTimeoutOptions,
  isTenantSessionRequest,
  sanitizeColumnPreferencesBody,
} from "@/lib/apiClientHelpers";
import { ApiError, isApiError, parseRetryAfterSeconds, type ApiErrorBody } from "./apiError";

export { ApiError, isApiError, type ApiErrorBody };
export { resolveApiUrl } from "@/lib/apiClientHelpers";

const JSON_CONTENT_TYPE = "application/json";

let refreshPromise: Promise<boolean> | null = null;
let lastRefreshedAt = 0;
const REFRESH_GRACE_PERIOD_MS = 5_000;

// Set for O(1) lookup — avoids a per-call array allocation in the hot CSRF path.
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"] as const);

export const SESSION_EXPIRED_EVENT = "mms:session-expired";

export function notifySessionExpired(reason?: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
  }
}

export function resetSessionRefreshStateForTests(): void {
  refreshPromise = null;
  lastRefreshedAt = 0;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    const headers = new Headers();
    const csrf = getCsrfCookieValue();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    headers.set("X-Request-Id", crypto.randomUUID());

    refreshPromise = executeFetchWithTimeout(API_REFRESH_PATH, {
      method: "POST",
      credentials: "include",
      headers,
      timeout: 10_000,
    } satisfies FetchWithTimeoutOptions)
      .then(
        (response): boolean => {
          if (response.ok) {
            lastRefreshedAt = Date.now();
            return true;
          }
          notifySessionExpired("refresh_failed");
          return false;
        },
        (): boolean => {
          notifySessionExpired("refresh_failed");
          return false;
        },
      )
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function isAuthenticationRequired(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  const raw = await response
    .clone()
    .json()
    .catch((): null => null);
  const body: ApiErrorBody | null =
    raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as ApiErrorBody) : null;
  if (body?.type === "session_idle_expired" || body?.type === "session_absolute_expired") {
    notifySessionExpired(body.type);
    return false;
  }
  return true;
}

function getCsrfCookieValue(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("The user aborted a request.", "AbortError");
  }
}

/**
 * A request retried after a successful refresh that is still rejected must end
 * the session. Without this, a rotated/blocked cookie or a revoked grant left
 * the app rendered as "authenticated" behind a permanent error because no
 * `SESSION_EXPIRED_EVENT` ever fired.
 */
async function finaliseRetriedResponse(path: string, response: Response): Promise<Response> {
  if (!isTenantSessionRequest(path) || response.status !== 401) return response;
  // `isAuthenticationRequired` notifies for the idle/absolute expiry shapes and
  // returns false; a generic 401 here means the refreshed session is unusable.
  if (await isAuthenticationRequired(response)) {
    notifySessionExpired("refresh_retry_failed");
  }
  return response;
}

/** Cookie-first API client (`credentials: 'include'`). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const isFormData = init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isFormData) {
    headers.set("Content-Type", JSON_CONTENT_TYPE);
  }

  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", crypto.randomUUID());
  }

  const method = (init.method || "GET").toUpperCase();
  if (
    CSRF_METHODS.has(method as "POST" | "PUT" | "PATCH" | "DELETE") &&
    !headers.has("X-CSRF-Token")
  ) {
    const csrf = getCsrfCookieValue();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const sanitizedInit = sanitizeColumnPreferencesBody(path, init);

  const requestInit: RequestInit = {
    ...sanitizedInit,
    credentials: "include",
    headers,
  };

  const response = await executeFetchWithTimeout(path, requestInit);

  if (isTenantSessionRequest(path) && (await isAuthenticationRequired(response))) {
    const buildRetryRequestInit = (): RequestInit => {
      const retryHeaders = new Headers(headers);
      if (CSRF_METHODS.has(method as "POST" | "PUT" | "PATCH" | "DELETE")) {
        const newCsrf = getCsrfCookieValue();
        if (newCsrf) retryHeaders.set("X-CSRF-Token", newCsrf);
      }
      return { ...requestInit, headers: retryHeaders };
    };

    if (Date.now() - lastRefreshedAt < REFRESH_GRACE_PERIOD_MS) {
      throwIfAborted(requestInit.signal);
      return finaliseRetriedResponse(
        path,
        await executeFetchWithTimeout(path, buildRetryRequestInit()),
      );
    }
    if (await refreshSession()) {
      throwIfAborted(requestInit.signal);
      return finaliseRetriedResponse(
        path,
        await executeFetchWithTimeout(path, buildRetryRequestInit()),
      );
    }
  }

  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text().catch((): string => "");

  if (!res.ok) {
    let errorBody: ApiErrorBody = {};
    try {
      if (text) {
        errorBody = JSON.parse(text) as ApiErrorBody;
      }
    } catch {
      errorBody = {
        message: text.substring(0, 100) || res.statusText || `Request failed (${res.status})`,
      };
    }
    const requestId = res.headers.get("x-request-id") ?? undefined;
    throw new ApiError(
      res.status,
      errorBody.message ?? `Request failed (${res.status})`,
      errorBody.type,
      requestId,
      errorBody.errors,
      parseRetryAfterSeconds(res.headers.get("retry-after")),
      errorBody.code,
    );
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse success JSON response: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}
