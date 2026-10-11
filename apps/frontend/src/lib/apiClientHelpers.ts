import { env } from "@/lib/config/env";
import { sanitizeColumnPreferencesBody } from "./apiColumnPreferencesSanitizer";

export { sanitizeColumnPreferencesBody };

/** Tenant auth endpoint paths — SSOT for AuthContext.tsx, twoFactor.ts, and the session interceptor. */
export const AUTH_PATHS = {
  me: "/api/auth/me",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  refresh: "/api/auth/refresh",
  onboard: "/api/auth/onboard",
  handoff: "/api/auth/handoff",
  onboardingStatus: "/api/auth/onboarding-status",
  twoFactorVerify: "/api/auth/2fa/verify",
  twoFactorResend: "/api/auth/2fa/resend",
  sessionExtend: "/api/auth/session/extend",
  forgotPassword: "/api/auth/forgot-password",
  forgotPasswordVerify: "/api/auth/forgot-password/verify",
  forgotPasswordReset: "/api/auth/forgot-password/reset",
  verifyPassword: "/api/auth/verify-password",
  uiState: "/api/auth/me/ui-state",
} as const;

/** Platform auth endpoint paths — SSOT for PlatformAuthContext.tsx, usePlatformProfile.ts, and usePlatformSessionTimeout.tsx. */
export const PLATFORM_AUTH_PATHS = {
  me: "/api/platform/auth/me",
  login: "/api/platform/auth/login",
  logout: "/api/platform/auth/logout",
  twoFactorVerify: "/api/platform/auth/2fa/verify",
  twoFactorResend: "/api/platform/auth/2fa/resend",
  sessionExtend: "/api/platform/auth/session/extend",
  sessionPolicy: "/api/platform/auth/session/policy",
  passwordForgot: "/api/platform/auth/password/forgot",
  passwordReset: "/api/platform/auth/password/reset",
  passwordResend: "/api/platform/auth/password/resend",
  changePassword: "/api/platform/auth/change-password",
  setupStatus: "/api/platform/auth/setup/status",
  setupRegister: "/api/platform/auth/setup/register",
} as const;

const REFRESH_PATH = AUTH_PATHS.refresh;

// Set for O(1) membership test — excluded from the token-refresh interceptor.
const TENANT_SESSION_EXCLUDED_PATHS: Set<string> = new Set([
  AUTH_PATHS.login,
  AUTH_PATHS.onboard,
  AUTH_PATHS.handoff,
  AUTH_PATHS.twoFactorVerify,
  AUTH_PATHS.twoFactorResend,
  AUTH_PATHS.onboardingStatus,
]);

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return env.apiUrl ? `${env.apiUrl}${normalized}` : normalized;
}

export function isTenantSessionRequest(path: string): boolean {
  const apiOrigin =
    env.apiUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost");

  const resolved = resolveApiUrl(path);

  if (!URL.canParse(resolved, apiOrigin) || !URL.canParse(apiOrigin)) return false;

  const url = new URL(resolved, apiOrigin);
  const expectedOrigin = new URL(apiOrigin).origin;

  if (url.origin !== expectedOrigin || !url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/api/platform/")) return false;
  if (url.pathname === REFRESH_PATH || url.pathname === AUTH_PATHS.logout) return false;

  return !TENANT_SESSION_EXCLUDED_PATHS.has(url.pathname);
}

/** Extends RequestInit with an optional per-request deadline (ms). */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Request timeout in milliseconds. Defaults to 15 000. */
  timeout?: number;
}

/**
 * fetch() wrapper that races the request against AbortSignal.timeout().
 * Uses AbortSignal.any() to merge caller-supplied signals with the deadline.
 */
export async function executeFetchWithTimeout(
  targetPath: string,
  baseInit: FetchWithTimeoutOptions,
): Promise<Response> {
  const timeoutMs = baseInit.timeout ?? 15_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = baseInit.signal
    ? AbortSignal.any([baseInit.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(resolveApiUrl(targetPath), { ...baseInit, signal });
}

export const API_REFRESH_PATH = REFRESH_PATH;
