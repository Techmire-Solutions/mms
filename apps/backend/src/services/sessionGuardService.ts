import type { SessionTimeoutPolicy } from "@mms/shared";
import {
  isSessionAbsoluteExpired,
  isSessionIdleExpired,
  revokeSession,
  touchSession,
} from "./sessionClockService.js";
import { deleteRefreshTokensForUser } from "./auth/authArtifactService.js";

/** The single enforcement outcome that callers map to an HTTP response. */
export type SessionClockOutcome = "ok" | "idle_expired" | "absolute_expired";

/**
 * SSOT for how an expiry outcome maps to an HTTP error `type` + message. All
 * auth layers (tenant middleware, platform middleware, refresh) share this.
 */
export const SESSION_EXPIRY_RESPONSE: Record<
  Exclude<SessionClockOutcome, "ok">,
  { type: string; message: string }
> = {
  idle_expired: {
    type: "session_idle_expired",
    message: "Session expired due to inactivity",
  },
  absolute_expired: {
    type: "session_absolute_expired",
    message: "Session reached its maximum duration",
  },
};

export interface SessionClockCheck {
  scope: string;
  policy: SessionTimeoutPolicy;
  /** Access-token jti to revoke on expiry (optional for refresh flows). */
  jti?: string;
  /** When present, refresh tokens are also revoked on expiry (full revocation). */
  userId?: string;
}

async function checkAndTouch({
  scope,
  policy,
  jti,
}: SessionClockCheck): Promise<SessionClockOutcome> {
  if (await isSessionIdleExpired(scope, policy.idleMs)) {
    await revokeSession(scope, jti);
    return "idle_expired";
  }
  if (await isSessionAbsoluteExpired(scope, policy.absoluteMs)) {
    await revokeSession(scope, jti);
    return "absolute_expired";
  }
  await touchSession(scope, policy.idleMs);
  return "ok";
}

/**
 * Single server-side enforcement path for tenant sessions: checks the idle and
 * absolute clocks and, on expiry, performs full revocation (clears the clock,
 * revokes the access token, and deletes the user's refresh tokens). Used by the
 * tenant auth middleware and the refresh endpoint.
 */
export async function enforceTenantSessionClock(
  opts: SessionClockCheck,
): Promise<SessionClockOutcome> {
  const outcome = await checkAndTouch(opts);
  if (outcome !== "ok" && opts.userId) {
    await deleteRefreshTokensForUser(opts.userId);
  }
  return outcome;
}

/**
 * Single server-side enforcement path for apex platform sessions. Platform
 * sessions have no refresh tokens, so expiry revocation is limited to the clock
 * and the access token.
 */
export async function enforcePlatformSessionClock(
  opts: SessionClockCheck,
): Promise<SessionClockOutcome> {
  return checkAndTouch(opts);
}
