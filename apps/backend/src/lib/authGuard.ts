import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionTimeoutPolicy } from "@mms/contracts";
import {
  RedisUnavailableError,
  enforceSessionClockOrReply as coreEnforceSessionClockOrReply,
  rejectOnAuthDependencyFailure as coreRejectOnAuthDependencyFailure,
  verifyJwtOrUnauthorized as coreVerifyJwtOrUnauthorized,
  type AuthDomain,
  type EnforceSessionClockOrReplyOptions as CoreEnforceSessionClockOrReplyOptions,
  type SessionClockCheck,
  type SessionClockOutcome,
} from "@mms/be-core/auth";

/** Shared auth-middleware helpers consumed by both console middlewares (be-core kernel). */

export type { AuthDomain, SessionClockCheck, SessionClockOutcome, SessionTimeoutPolicy };

/** True when the error is the fail-closed "auth dependency unavailable" signal. */
export function isAuthDependencyUnavailable(error: unknown): boolean {
  return error instanceof RedisUnavailableError;
}

/** Rejects a request with the console-specific retryable 503 when Redis is unavailable. */
export async function rejectOnAuthDependencyFailure(
  reply: FastifyReply,
  error: unknown,
  domain: AuthDomain,
): Promise<boolean> {
  return coreRejectOnAuthDependencyFailure(reply, error, domain, isAuthDependencyUnavailable);
}

/** Verifies the request JWT, writing a 401 when verification fails. */
export async function verifyJwtOrUnauthorized(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  return coreVerifyJwtOrUnauthorized(request as unknown as { jwtVerify(): Promise<void> }, reply);
}

export type EnforceSessionClockOrReplyOptions = Omit<
  CoreEnforceSessionClockOrReplyOptions,
  "isDependencyUnavailable"
>;

/** Runs the console-specific session-clock enforcement and maps outcomes to responses. */
export async function enforceSessionClockOrReply(
  request: FastifyRequest,
  reply: FastifyReply,
  options: EnforceSessionClockOrReplyOptions,
): Promise<boolean> {
  return coreEnforceSessionClockOrReply(request, reply, {
    ...options,
    isDependencyUnavailable: isAuthDependencyUnavailable,
  });
}
