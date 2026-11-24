import {
  TENANT_AUTH_ERROR_TYPES,
  type AppTranslationKey,
  type TenantAuthErrorType,
} from "@mms/contracts";
import { ApiError } from "../api/client";
import type { TranslationFunction } from "../i18n/types";
import { mapAuthError, type MapAuthErrorConfig } from "./mapAuthError";

export interface AuthError {
  type: TenantAuthErrorType;
  message: string;
  retryAfterSeconds?: number;
}

const TENANT_AUTH_ERROR_KEYS: Partial<Record<TenantAuthErrorType, AppTranslationKey>> = {
  invalid_credentials: "auth.invalidCredentials",
  email_not_verified: "auth.emailNotVerified",
  workspace_disabled: "errors.state.permission",
  connection_error: "errors.state.network",
  rate_limit_exceeded: "errors.rate_limit_exceeded",
};

const TENANT_AUTH_ERROR_MAPPING: MapAuthErrorConfig = {
  isErrorType: isAuthErrorType,
  keyMap: TENANT_AUTH_ERROR_KEYS,
  statusMap: {},
  fallbackKey: "auth.invalidCredentials",
  messageFirstTypes: ["workspace_disabled"],
  messageFirstOnUnknown: true,
};

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

export function isAuthErrorType(value: unknown): value is TenantAuthErrorType {
  return (
    typeof value === "string" && (TENANT_AUTH_ERROR_TYPES as readonly string[]).includes(value)
  );
}

export async function parseAuthError(response: Response): Promise<AuthError> {
  try {
    const data = (await response.json()) as { type?: unknown; message?: unknown };
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
    return {
      type: isAuthErrorType(data.type) ? data.type : "invalid_credentials",
      message:
        typeof data.message === "string" && data.message.trim() ? data.message : "Login failed",
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    };
  } catch {
    return {
      type: response.status === 401 ? "invalid_credentials" : "connection_error",
      message: "Login failed",
    };
  }
}

/**
 * Maps tenant auth failures to localized copy, preventing raw backend English
 * strings from leaking into non-English locales (Arabic, Urdu, Persian).
 */
export function getAuthErrorMessage(error: unknown, t: TranslationFunction): string {
  const authErr =
    error && typeof error === "object" && "authError" in error
      ? (error as { authError: AuthError }).authError
      : undefined;

  if (authErr) {
    const message = mapAuthError(authErr, TENANT_AUTH_ERROR_MAPPING, t);
    return authErr.type === "rate_limit_exceeded" && authErr.retryAfterSeconds !== undefined
      ? `${message} ${t("errors.retryAfterSeconds", { seconds: String(authErr.retryAfterSeconds) })}`
      : message;
  }

  if (error instanceof ApiError) {
    if (isAuthErrorType(error.type)) {
      return mapAuthError(error, TENANT_AUTH_ERROR_MAPPING, t);
    }
    if (error.status === 401) {
      return t("auth.invalidCredentials");
    }
    if (error.status === 403) {
      return error.message || t("errors.state.permission");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return t("auth.invalidCredentials");
}
