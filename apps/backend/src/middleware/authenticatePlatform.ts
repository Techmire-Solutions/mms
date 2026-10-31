import type { FastifyReply, FastifyRequest } from "fastify";
import type { PlatformAdminPermissionKey, PlatformUser } from "@mms/shared";
import { platformUserCan } from "@mms/shared";
import { platformSessionScope } from "../services/sessionClockService.js";
import {
  enforcePlatformSessionClock,
  SESSION_EXPIRY_RESPONSE,
} from "../services/sessionGuardService.js";
import { platformSessionPolicy } from "../services/sessionPolicyService.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { attachPlatformTokenFromCookie } from "../services/platform/platformCookieService.js";
import type { PlatformAccessTokenPayload } from "../services/platform/platformAuthService.js";
import {
  getStoredPlatformUserById,
  toPublicPlatformUser,
} from "../services/platform/platformUserService.js";
import { sendForbidden, sendServiceUnavailable, sendUnauthorized } from "../lib/httpErrors.js";
import { isTokenRevoked } from "../services/authSessionService.js";
import { RedisUnavailableError } from "../lib/redis.js";

export interface PlatformAuthenticatedRequest extends FastifyRequest {
  platformUser: PlatformUser;
}

export interface PlatformOptionalAuthRequest extends FastifyRequest {
  platformUser?: PlatformUser;
}

type PlatformAuthFailureReason =
  | "auth_required"
  | "invalid_session"
  | "user_missing"
  | "account_disabled"
  | "session_revoked"
  | "dependency_unavailable";

type PlatformAuthResolveResult =
  { ok: true; user: PlatformUser } | { ok: false; reason: PlatformAuthFailureReason };

/**
 * Hook to enforce that the request is only allowed on the main domain (no tenant subdomain context).
 */
export async function requireMainDomain(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (getRequestTenant()) {
    await sendForbidden(reply, "Platform actions are only available on the main domain");
    return;
  }
}

/**
 * Resolve platform session from cookie without writing a response.
 * Used by hard `authenticatePlatform` and soft GET `/me` probe.
 */
export async function resolvePlatformUser(
  request: FastifyRequest,
): Promise<PlatformAuthResolveResult> {
  delete request.headers.authorization;
  attachPlatformTokenFromCookie(request);

  try {
    await request.jwtVerify();
  } catch {
    return { ok: false, reason: "auth_required" };
  }

  const payload = request.user as PlatformAccessTokenPayload;
  if (payload.tokenType !== "platform_access") {
    return { ok: false, reason: "invalid_session" };
  }

  if (payload.jti) {
    let revoked: boolean;
    try {
      revoked = await isTokenRevoked(payload.jti);
    } catch (error) {
      if (error instanceof RedisUnavailableError) {
        return { ok: false, reason: "dependency_unavailable" };
      }
      throw error;
    }
    if (revoked) return { ok: false, reason: "session_revoked" };
  }

  const stored = await getStoredPlatformUserById(payload.id);
  if (!stored) {
    return { ok: false, reason: "user_missing" };
  }

  if (stored.disabledAt) {
    return { ok: false, reason: "account_disabled" };
  }

  if ((payload.sessionVersion ?? 0) !== stored.sessionVersion) {
    return { ok: false, reason: "session_revoked" };
  }

  return { ok: true, user: toPublicPlatformUser(stored) };
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

/**
 * Apex-only JWT for platform operators (separate from tenant madrasa sessions).
 * Reloads role + permissions from DB so permission edits apply without re-login.
 */
export async function authenticatePlatform(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireMainDomain(request, reply);
  if (reply.sent) return;

  const resolved = await resolvePlatformUser(request);
  if (!resolved.ok) {
    await sendPlatformAuthFailure(reply, resolved.reason);
    return;
  }

  // Server-authoritative inactivity + absolute lifetime enforcement for apex sessions.
  const sessionPolicy = platformSessionPolicy();
  const idleScope = platformSessionScope(resolved.user.id);
  const jti = (request.user as PlatformAccessTokenPayload | undefined)?.jti;
  let idleOutcome: Awaited<ReturnType<typeof enforcePlatformSessionClock>>;
  try {
    idleOutcome = await enforcePlatformSessionClock({
      scope: idleScope,
      policy: sessionPolicy,
      jti,
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      await sendServiceUnavailable(
        reply,
        "Platform session validation is temporarily unavailable. Please retry.",
      );
      return;
    }
    throw error;
  }
  if (idleOutcome !== "ok") {
    const expiry = SESSION_EXPIRY_RESPONSE[idleOutcome];
    return sendUnauthorized(reply, expiry.message, expiry.type);
  }

  (request as PlatformAuthenticatedRequest).platformUser = resolved.user;
}

/**
 * Soft apex probe for GET `/me`: sets `platformUser` when valid, otherwise leaves unset.
 * Never writes 401 — callers return `200 { user: null }` when absent.
 */
export async function optionalAuthenticatePlatform(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireMainDomain(request, reply);
  if (reply.sent) return;

  const resolved = await resolvePlatformUser(request);
  if (resolved.ok) {
    (request as PlatformOptionalAuthRequest).platformUser = resolved.user;
  }
}

/**
 * Allows super-users always, or admins with the given grantable permission.
 */
export function requirePlatformPermission(permission: PlatformAdminPermissionKey) {
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

/**
 * Restricts an endpoint to the platform super-user role. Used for the most
 * sensitive operations (admin management, DB reset, migrate-and-restart) so a
 * grantable permission can never be escalated into full platform control.
 */
export function requirePlatformSuperUser() {
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
