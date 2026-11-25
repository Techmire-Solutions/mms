import type { FastifyReply, FastifyRequest } from "fastify";
import type { PlatformAdminPermissionKey, PlatformUser } from "@mms/contracts";
import { platformUserCan } from "@mms/contracts";
import { getRequestTenant } from "@mms/db/request-context";
import {
  enforceSessionClockOrReply,
  type SessionClockCheck,
  type SessionClockOutcome,
  type SessionTimeoutPolicy,
} from "./session.js";
import { sendForbidden, sendServiceUnavailable, sendUnauthorized } from "./responses.js";

export interface PlatformAuthenticatedRequest extends FastifyRequest {
  platformUser: PlatformUser;
}

export interface PlatformOptionalAuthRequest extends FastifyRequest {
  platformUser?: PlatformUser;
}

export type PlatformAuthFailureReason =
  | "auth_required"
  | "invalid_session"
  | "user_missing"
  | "account_disabled"
  | "session_revoked"
  | "dependency_unavailable";

export type PlatformAuthResolveResult =
  { ok: true; user: PlatformUser } | { ok: false; reason: PlatformAuthFailureReason };

export interface PlatformAuthPorts {
  /** Resolves + validates the platform session without writing a response. */
  resolveUser(request: FastifyRequest): Promise<PlatformAuthResolveResult>;
  sessionPolicy(): SessionTimeoutPolicy;
  sessionScope(userId: string): string;
  enforceSessionClock(check: SessionClockCheck): Promise<SessionClockOutcome>;
  isDependencyUnavailable(error: unknown): boolean;
}

export interface PlatformAdminGuard {
  /** Apex-only hard auth; writes 401/403/503. */
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** Apex-only soft probe used by GET /me; never writes 401. */
  optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireMainDomain: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission(
    permission: PlatformAdminPermissionKey,
  ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireSuperUser(): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

async function sendPlatformAuthFailure(
  reply: FastifyReply,
  reason: PlatformAuthFailureReason,
): Promise<void> {
  switch (reason) {
    case "account_disabled":
      await sendUnauthorized(reply, "Platform account has been disabled", "account_disabled");
      return;
    case "session_revoked":
      await sendUnauthorized(reply, "Platform session has been revoked", "session_revoked");
      return;
    case "user_missing":
      await sendUnauthorized(reply, "User no longer exists");
      return;
    case "invalid_session":
      await sendUnauthorized(reply, "Invalid platform session");
      return;
    case "dependency_unavailable":
      await sendServiceUnavailable(
        reply,
        "Platform session validation is temporarily unavailable. Please retry.",
      );
      return;
    case "auth_required":
    default:
      await sendUnauthorized(reply, "Platform authentication is required");
  }
}

/** Hook restricting platform endpoints to the apex host (no tenant context). */
export async function requireMainDomain(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (getRequestTenant()) {
    await sendForbidden(reply, "Platform actions are only available on the main domain");
  }
}

/**
 * Builds the platform/super-admin guard.
 *
 * Failure mapping and session-clock enforcement live here; stored-user lookup
 * and platform settings stay behind ports so the package never imports app
 * services.
 */
export function createPlatformAdminGuard(ports: PlatformAuthPorts): PlatformAdminGuard {
  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireMainDomain(request, reply);
    if (reply.sent) return;

    let resolved: PlatformAuthResolveResult;
    try {
      resolved = await ports.resolveUser(request);
    } catch (error) {
      if (ports.isDependencyUnavailable(error)) {
        await sendPlatformAuthFailure(reply, "dependency_unavailable");
        return;
      }
      throw error;
    }
    if (!resolved.ok) {
      await sendPlatformAuthFailure(reply, resolved.reason);
      return;
    }

    const sessionPolicy = ports.sessionPolicy();
    const idleScope = ports.sessionScope(resolved.user.id);
    const jti = (request as unknown as { user?: { jti?: string } }).user?.jti;
    const clockOk = await enforceSessionClockOrReply(request, reply, {
      scope: idleScope,
      policy: sessionPolicy,
      jti,
      enforce: ports.enforceSessionClock,
      domain: "platform",
      isDependencyUnavailable: ports.isDependencyUnavailable,
    });
    if (!clockOk) return;

    (request as PlatformAuthenticatedRequest).platformUser = resolved.user;
  }

  async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireMainDomain(request, reply);
    if (reply.sent) return;
    let resolved: PlatformAuthResolveResult;
    try {
      resolved = await ports.resolveUser(request);
    } catch (error) {
      if (ports.isDependencyUnavailable(error)) return;
      throw error;
    }
    if (resolved.ok) {
      (request as PlatformOptionalAuthRequest).platformUser = resolved.user;
    }
  }

  function requirePermission(permission: PlatformAdminPermissionKey) {
    return async function requirePlatformPermissionHook(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      if (reply.sent) return;
      const req = request as PlatformAuthenticatedRequest;
      if (!platformUserCan(req.platformUser, permission)) {
        await sendForbidden(reply, `Missing platform permission: ${permission}`);
      }
    };
  }

  function requireSuperUser() {
    return async function requirePlatformSuperUserHook(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      if (reply.sent) return;
      const req = request as PlatformAuthenticatedRequest;
      if (req.platformUser.role !== "super_user") {
        await sendForbidden(reply, "Super-user privilege required");
      }
    };
  }

  return {
    authenticate,
    optionalAuthenticate,
    requireMainDomain,
    requirePermission,
    requireSuperUser,
  };
}

/** Canonical idle-clock scope for a platform operator. */
export function platformSessionScope(userId: string): string {
  return `plat:${userId}`;
}
