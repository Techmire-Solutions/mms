import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionTimeoutPolicy } from "@mms/shared";
import { RedisUnavailableError } from "./authRedisReads.js";
import { sendServiceUnavailable, sendUnauthorized } from "./httpErrors.js";
import {
  SESSION_EXPIRY_RESPONSE,
  type SessionClockCheck,
  type SessionClockOutcome,
} from "../services/sessionGuardService.js";

/**
 * Shared auth-middleware helpers consumed by both console middlewares
 * (`authenticateTenant`, `authenticatePlatform`) — mms-dry §2. Token-type
 * rejection and tenant-binding checks stay console-specific.
 */

const DEPENDENCY_FAILURE_MESSAGES = {
  tenant: "Session validation is temporarily unavailable. Please retry.",
  platform: "Platform session validation is temporarily unavailable. Please retry.",
} as const;

export type AuthDomain = keyof typeof DEPENDENCY_FAILURE_MESSAGES;

/**
 * True when the error is the fail-closed "auth dependency unavailable" signal
 * (Redis configured but unreachable). Callers that cannot write a response
 * (e.g. `resolvePlatformUser`) use this directly.
 */
export function isAuthDependencyUnavailable(error: unknown): boolean {
  return error instanceof RedisUnavailableError;
}

/**
 * Rejects a request with the console-specific retryable 503 when the error is
 * an auth-dependency failure. Returns true when the reply was written (callers
 * must return); unexpected errors fall through to the caller's throw.
 */
export async function rejectOnAuthDependencyFailure(
  reply: FastifyReply,
  error: unknown,
  domain: AuthDomain,
): Promise<boolean> {
  if (!isAuthDependencyUnavailable(error)) return false;
  await sendServiceUnavailable(reply, DEPENDENCY_FAILURE_MESSAGES[domain]);
  return true;
}

/** Verifies the request JWT, writing a 401 when verification fails. */
export async function verifyJwtOrUnauthorized(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    await sendUnauthorized(reply);
    return false;
  }
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
    if (await rejectOnAuthDependencyFailure(reply, error, options.domain)) return false;
    throw error;
  }
  if (outcome !== "ok") {
    const expiry = SESSION_EXPIRY_RESPONSE[outcome];
    await sendUnauthorized(reply, expiry.message, expiry.type);
    return false;
  }
  return true;
}
