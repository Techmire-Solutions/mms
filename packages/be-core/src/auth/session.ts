import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionTimeoutPolicy } from "@mms/contracts";
export type { SessionTimeoutPolicy };
import { sendServiceUnavailable, sendUnauthorized } from "./responses.js";

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

export type AuthDomain = "tenant" | "platform";

const DEPENDENCY_FAILURE_MESSAGES: Record<AuthDomain, string> = {
  tenant: "Session validation is temporarily unavailable. Please retry.",
  platform: "Platform session validation is temporarily unavailable. Please retry.",
};

/**
 * Rejects a request with the console-specific retryable 503 when the error is
 * an auth-dependency failure. Returns true when the reply was written (callers
 * must return); unexpected errors fall through to the caller's throw.
 */
export async function rejectOnAuthDependencyFailure(
  reply: FastifyReply,
  error: unknown,
  domain: AuthDomain,
  isDependencyUnavailable: (error: unknown) => boolean,
): Promise<boolean> {
  if (!isDependencyUnavailable(error)) return false;
  await sendServiceUnavailable(reply, DEPENDENCY_FAILURE_MESSAGES[domain]);
  return true;
}

export interface EnforceSessionClockOrReplyOptions {
  scope: string;
  policy: SessionTimeoutPolicy;
  jti?: string;
  /** When present, refresh tokens are also revoked on expiry (tenant flows). */
  userId?: string;
  /** The console-specific enforcement path (tenant revokes refresh tokens). */
  enforce(check: SessionClockCheck): Promise<SessionClockOutcome>;
  /** Console used for the dependency-failure copy. */
  domain: AuthDomain;
  isDependencyUnavailable(error: unknown): boolean;
}

/**
 * Runs the console-specific session-clock enforcement, mapping a dependency
 * outage to the retryable 503 and every expiry outcome to the shared 401
 * envelope. Returns false when a reply was written (callers must return).
 */
export async function enforceSessionClockOrReply(
  _request: FastifyRequest,
  reply: FastifyReply,
  options: EnforceSessionClockOrReplyOptions,
): Promise<boolean> {
  let outcome: SessionClockOutcome;
  try {
    outcome = await options.enforce({
      scope: options.scope,
      policy: options.policy,
      jti: options.jti,
      userId: options.userId,
    });
  } catch (error) {
    if (
      await rejectOnAuthDependencyFailure(
        reply,
        error,
        options.domain,
        options.isDependencyUnavailable,
      )
    ) {
      return false;
    }
    throw error;
  }
  if (outcome !== "ok") {
    const expiry = SESSION_EXPIRY_RESPONSE[outcome];
    await sendUnauthorized(reply, expiry.message, expiry.type);
    return false;
  }
  return true;
}
