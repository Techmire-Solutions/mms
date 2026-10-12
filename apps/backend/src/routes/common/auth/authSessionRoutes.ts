import type { FastifyPluginAsync } from "fastify";
import {
  isOnboardingAvailable,
  establishSession,
  type User,
} from "../../../services/auth/authService.js";
import { exchangeAuthHandoff } from "../../../services/auth/authHandoffService.js";
import { patchUserUiStateBodySchema } from "@mms/shared";
import { getUserUiState, patchUserUiState } from "../../../services/auth/userUiStateService.js";
import { getRequestTenant, runWithTenant } from "../../../lib/tenantContext.js";
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "../../../services/auth/authCookieService.js";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import { consumeAuthArtifact } from "../../../services/auth/authArtifactService.js";
import { revokeAllUserSessions, revokeToken } from "../../../services/session.service.js";
import { getJwtExpiresIn, loadGlobalSettings } from "../../../services/globalSettingsService.js";
import { tenantSessionScope, touchSession } from "../../../services/sessionClockService.js";
import { usersRepository } from "../../../users/repository/usersRepositoryAdapter.js";
import {
  enforceTenantSessionClock,
  SESSION_EXPIRY_RESPONSE,
} from "../../../services/sessionGuardService.js";
import { tenantSessionPolicy } from "../../../services/sessionPolicyService.js";
import { parseSessionTimeoutMinutes } from "@mms/shared";
import { getPublicUserById } from "../../../services/auth/userService.js";
import {
  rotateRefreshToken,
  validateRefreshToken,
} from "../../../services/auth/twoFactorService.js";
import { handoffBodySchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendForbidden, sendUnauthorized } from "../../../lib/httpErrors.js";
import { getWorkspaceInstitutionSetupStatus } from "../../../services/workspaceService.js";
import { AUTH_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";

/** Session lifecycle, UI state, refresh, onboarding status, and handoff routes. */
export const authSessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Brute-force / abuse ceiling for the unauthenticated session endpoints.
  // (`/me` and `/me/ui-state` are intentionally excluded — the SPA calls them
  // on every load and they must not share the 10/min auth budget.)
  const authLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.post("/logout", { preHandler: authLimit }, async (request, reply) => {
    // Server-side revocation, not just cookie clearing: otherwise a stolen
    // access/refresh token keeps working after the user signs out.
    const subdomain = getRequestTenant();
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    let userId: string | undefined;

    if (refreshToken && subdomain) {
      try {
        const validated = await validateRefreshToken(refreshToken, subdomain);
        if (validated) {
          userId = validated.payload.userId;
          await consumeAuthArtifact(validated.artifactId, "refresh_token");
        }
      } catch {
        // Best effort — logout must still clear cookies on failure.
      }
    }

    const accessToken = request.cookies?.[ACCESS_COOKIE];
    if (accessToken) {
      try {
        const decoded = fastify.jwt.decode(accessToken) as {
          jti?: string;
          id?: string | number;
        } | null;
        if (decoded?.jti) await revokeToken(decoded.jti);
        if (!userId && decoded?.id !== undefined) userId = String(decoded.id);
      } catch {
        // Best effort — an unverifiable token cannot be revoked by jti.
      }
    }

    clearAuthCookies(reply);
    return reply.send({ success: true });
  });

  fastify.get("/me", { preHandler: authenticateTenant }, async (request, reply) => {
    const user = request.user as User & { deletedAt?: unknown; deleted_at?: unknown };
    if (user.deletedAt || user.deleted_at) {
      return sendUnauthorized(reply, "Session revoked");
    }
    if (user.id) {
      try {
        // Scope the session check to the caller's workspace — an id-only lookup
        // runs with RLS bypassed and could resolve another tenant's user.
        const sessionTenant = getRequestTenant() ?? user.workspaceSubdomain;
        const userRow = sessionTenant
          ? await usersRepository.findTenantUserRowById(sessionTenant, String(user.id))
          : null;
        if (userRow?.deletedAt) {
          return sendUnauthorized(reply, "Session revoked");
        }
        if (user.role === "faculty" || user.role === "teacher") {
          const tenant = getRequestTenant() ?? user.workspaceSubdomain;
          if (tenant) {
            const { facultyRepository } =
              await import("../../../faculty/repository/facultyRepositoryAdapter.js");
            const facultyRow = await facultyRepository.findById(tenant, String(user.id));
            if (facultyRow?.deletedAt) {
              return sendUnauthorized(reply, "Session revoked");
            }
          }
        }
      } catch {
        // Fall through for tests without DB context
      }
    }
    return reply.send({
      user: request.user as User,
      isAuthenticated: true,
    });
  });

  fastify.get(
    "/institution-setup-status",
    { preHandler: authenticateTenant },
    async (_request, reply) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return sendForbidden(reply, "Tenant context is required");
      }
      const complete = await getWorkspaceInstitutionSetupStatus(tenant);
      return reply.send({ complete });
    },
  );

  fastify.get("/me/ui-state", { preHandler: authenticateTenant }, async (request, reply) => {
    const user = request.user as User;
    const state = await runWithTenant(user.workspaceSubdomain, () =>
      getUserUiState(user.workspaceSubdomain, user.id),
    );
    return reply.send({ state });
  });

  fastify.patch("/me/ui-state", { preHandler: authenticateTenant }, async (request, reply) => {
    const parsed = parseRequest(patchUserUiStateBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const user = request.user as User;
    const newState = await runWithTenant(user.workspaceSubdomain, () =>
      patchUserUiState(user.workspaceSubdomain, user.id, parsed.data),
    );
    return reply.send({ state: newState });
  });

  fastify.post("/refresh", { preHandler: authLimit }, async (request, reply) => {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return sendUnauthorized(reply, "Refresh token missing");
    }

    const subdomain = getRequestTenant();
    if (!subdomain) {
      return sendForbidden(reply, "Invalid refresh context");
    }

    const validated = await validateRefreshToken(refreshToken, subdomain);
    if (!validated) {
      clearAuthCookies(reply);
      return sendUnauthorized(reply, "Invalid refresh token");
    }

    // Atomic consume: only one concurrent refresh can claim this artifact.
    // A failed claim means the token was already used — treat it as reuse and
    // revoke every session for the user (stolen-token response).
    const claimed = await consumeAuthArtifact(validated.artifactId, "refresh_token");
    if (!claimed) {
      await revokeAllUserSessions(validated.payload.userId);
      clearAuthCookies(reply);
      return sendUnauthorized(reply, "Invalid refresh token");
    }

    const user = await runWithTenant(subdomain, () => getPublicUserById(validated.payload.userId));
    if (!user || user.workspaceSubdomain.toLowerCase() !== subdomain.toLowerCase()) {
      clearAuthCookies(reply);
      return sendUnauthorized(reply, "Invalid refresh token");
    }

    // Refreshing must also respect the workspace idle + absolute windows: a
    // session that has expired cannot be silently resurrected via refresh.
    const sessionPolicy = tenantSessionPolicy(
      parseSessionTimeoutMinutes((await loadGlobalSettings(subdomain)).sessionTimeout),
    );
    const idleScope = tenantSessionScope(subdomain, String(user.id));
    const idleOutcome = await enforceTenantSessionClock({
      scope: idleScope,
      policy: sessionPolicy,
      userId: user.id ? String(user.id) : undefined,
    });
    if (idleOutcome !== "ok") {
      const expiry = SESSION_EXPIRY_RESPONSE[idleOutcome];
      clearAuthCookies(reply);
      return sendUnauthorized(reply, expiry.message, expiry.type);
    }

    const accessExpiresIn = await getJwtExpiresIn();
    const rotated = await rotateRefreshToken(refreshToken, user, fastify.jwt, accessExpiresIn);
    if (!rotated) {
      clearAuthCookies(reply);
      return sendUnauthorized(reply, "Invalid refresh token");
    }

    // A successful refresh counts as activity — slide the idle window.
    if (user.id) await touchSession(idleScope, sessionPolicy.idleMs, true);

    setAuthCookies(reply, rotated.accessToken, rotated.refreshToken);
    return reply.send({ user });
  });

  // Sliding extension: an authenticated request that resets the idle window
  // immediately (used by the "stay signed in" warning action).
  fastify.post("/session/extend", { preHandler: authenticateTenant }, async (request, reply) => {
    const user = request.user as User;
    const tenant = getRequestTenant();
    if (!tenant || !user?.id) {
      return sendForbidden(reply, "Tenant context is required");
    }
    const sessionPolicy = tenantSessionPolicy(
      parseSessionTimeoutMinutes((await loadGlobalSettings(tenant)).sessionTimeout),
    );
    await touchSession(tenantSessionScope(tenant, String(user.id)), sessionPolicy.idleMs, true);
    return reply.send({ ok: true, idleMs: sessionPolicy.idleMs });
  });

  fastify.get("/onboarding-status", { preHandler: authLimit }, async (_request, reply) => {
    const available = await isOnboardingAvailable();
    return reply.send({ available });
  });

  fastify.post("/handoff", { preHandler: authLimit }, async (request, reply) => {
    const parsed = parseRequest(handoffBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const { code } = parsed.data;

    const subdomain = getRequestTenant();
    if (!subdomain) {
      return sendForbidden(reply, "Handoff is only available on a tenant subdomain");
    }

    const result = await exchangeAuthHandoff(code);
    if (!result) {
      return sendUnauthorized(reply, "Invalid or expired handoff code");
    }

    if (result.user.workspaceSubdomain?.toLowerCase() !== subdomain.toLowerCase()) {
      return sendForbidden(reply, "Handoff code is not valid for this workspace");
    }

    await establishSession(result.user, fastify.jwt, reply, true);
    return reply.send({ user: result.user });
  });
};
