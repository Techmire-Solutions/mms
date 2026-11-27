import type { FastifyRequest } from "fastify";
import type { PlatformUser } from "@mms/contracts";
import {
  createPlatformAdminGuard,
  platformSessionScope,
  type PlatformAuthFailureReason,
  type PlatformAuthResolveResult,
} from "@mms/be-core/auth";
import { attachPlatformTokenFromCookie } from "@mms/mod-platform/backend/platform/services";
import type { PlatformAccessTokenPayload } from "@mms/mod-platform/backend/platform/services";
import {
  getStoredPlatformUserById,
  toPublicPlatformUser,
} from "@mms/mod-platform/backend/platform/services";
import { isAuthDependencyUnavailable } from "../lib/authGuard.js";
import { isTokenRevoked } from "@mms/be-core/auth/sessionRevocation";
import { platformSessionPolicy } from "@mms/mod-sessions/backend/services";
import { enforcePlatformSessionClock } from "@mms/mod-sessions/backend/services";

export interface PlatformAuthenticatedRequest extends FastifyRequest {
  platformUser: PlatformUser;
}

export interface PlatformOptionalAuthRequest extends FastifyRequest {
  platformUser?: PlatformUser;
}

export type { PlatformAuthFailureReason };

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
      if (isAuthDependencyUnavailable(error)) {
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

const guard = createPlatformAdminGuard({
  resolveUser: resolvePlatformUser,
  sessionPolicy: platformSessionPolicy,
  sessionScope: platformSessionScope,
  enforceSessionClock: enforcePlatformSessionClock,
  isDependencyUnavailable: isAuthDependencyUnavailable,
});

/**
 * Apex-only JWT for platform operators (separate from tenant madrasa sessions).
 * Reloads role + permissions from DB so permission edits apply without re-login.
 */
export const authenticatePlatform = guard.authenticate;
/** Canonical name for the extracted super-admin guard. */
export const platformAdminGuard = guard.authenticate;
export const requireMainDomain = guard.requireMainDomain;
export const requirePlatformPermission = guard.requirePermission;
export const requirePlatformSuperUser = guard.requireSuperUser;
export const optionalAuthenticatePlatform = guard.optionalAuthenticate;
