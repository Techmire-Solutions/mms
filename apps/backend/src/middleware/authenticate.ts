import type { FastifyReply, FastifyRequest } from "fastify";
import type { GlobalSettings, User, Workspace } from "@mms/shared";
import { isWorkspaceEnabled, parseSessionTimeoutMinutes } from "@mms/shared";
import { tenantSessionScope } from "../services/sessionClockService.js";
import {
  enforceTenantSessionClock,
  SESSION_EXPIRY_RESPONSE,
} from "../services/sessionGuardService.js";
import { tenantSessionPolicy } from "../services/sessionPolicyService.js";
import {
  bindRequestTenant,
  bindRequestUserId,
  bindRequestAuditContext,
  getRequestTenant,
  resolveSubdomainFromRequest,
} from "../lib/tenantContext.js";
import { formatTraceParent } from "../config/telemetry.js";
import { getWorkspaceBySubdomain } from "../services/workspaceService.js";
import { loadGlobalSettings } from "../services/globalSettingsService.js";
import { sendForbidden, sendUnauthorized } from "../lib/httpErrors.js";
import { checkTenantAuthPipelineBatch } from "../services/authSessionService.js";
import { markRequestDiagnosticStage } from "../lib/requestDiagnostics.js";

export interface AuthenticatedRequest extends FastifyRequest {
  user: User & {
    twoFactorVerified?: boolean;
    tokenType?: string;
    jti?: string;
    iat?: number;
    iat_ms?: number;
    exp?: number;
  };
  /** Tenant bound after successful authentication (workspace subdomain). */
  tenant: { id: string };
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by authenticateTenant once the tenant passes all auth checks. */
    tenant?: { id: string };
  }
}

/**
 * Verifies JWT (cookie or Authorization header) and binds the token workspace to the request host.
 */
export async function authenticateTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  markRequestDiagnosticStage(request, "authentication_jwt");
  try {
    await request.jwtVerify();
  } catch {
    await sendUnauthorized(reply);
    return;
  }

  const user = request.user as User & {
    twoFactorVerified?: boolean;
    tokenType?: string;
    jti?: string;
    iat?: number;
    iat_ms?: number;
  };
  markRequestDiagnosticStage(request, "authentication_tenant_context");
  let tenant = getRequestTenant();
  if (!tenant) {
    tenant = resolveSubdomainFromRequest(
      request.headers.host,
      request.headers["x-forwarded-host"] as string | string[] | undefined,
    );
    if (tenant) {
      bindRequestTenant(tenant);
    }
  }

  if (!tenant) {
    await sendForbidden(reply, "This endpoint requires a tenant subdomain");
    return;
  }

  // Fast-path Redis tenant blocklist, token/session revocation, user active status,
  // global settings, and workspace lookup batched into a single pipelined round-trip.
  markRequestDiagnosticStage(request, "authentication_tenant_blocklist");
  const { tenantBlocked, tokenRevoked, userSessionRevoked, globalSettingsCached, workspaceCached } =
    await checkTenantAuthPipelineBatch({
      tenant,
      jti: user.jti,
      userId: user.id ? String(user.id) : undefined,
      role: user.role,
      issuedAtMs: user.iat_ms ?? (user.iat ? user.iat * 1000 : undefined),
    });
  if (tenantBlocked) {
    await reply.status(403).send({
      type: "workspace_disabled",
      message: "This madrasa workspace has been disabled by the platform administrator.",
    });
    return;
  }

  markRequestDiagnosticStage(request, "authentication_token_revocation");
  if (tokenRevoked) {
    await sendUnauthorized(reply, "Session revoked");
    return;
  }

  markRequestDiagnosticStage(request, "authentication_user_session_revocation");
  if (userSessionRevoked) {
    await sendUnauthorized(reply, "Session revoked");
    return;
  }

  // Soft-deleted accounts must not retain access or active sessions (SSOT §1.2 & §4.7).
  markRequestDiagnosticStage(request, "authentication_account_active");
  const userClaims = user as unknown as { deletedAt?: unknown; deleted_at?: unknown };
  if (userClaims.deletedAt || userClaims.deleted_at) {
    await sendUnauthorized(reply, "Session revoked");
    return;
  }

  if (user.id) {
    try {
      const { getTenantRoleMatrix } = await import("../services/rbacService.js");
      const matrix = await getTenantRoleMatrix(tenant);
      const userStatus = matrix[String(user.id)];
      if (!userStatus || userStatus.deletedAt) {
        await sendUnauthorized(reply, "Session revoked");
        return;
      }
      // Replace the (up to ~15-min stale) JWT role with the authoritative matrix
      // role so every downstream `roleHasPermission(request.user.role, …)` check —
      // including non-module surfaces like /api/db, /api/email, /api/sms — reflects
      // role changes immediately, without waiting for a token refresh.
      if (userStatus.role) {
        user.role = userStatus.role;
      }
      if (user.role === "faculty" || user.role === "teacher") {
        const { facultyRepository } =
          await import("../faculty/repository/facultyRepositoryAdapter.js");
        const facultyRow = await facultyRepository.findById(tenant, String(user.id));
        if (facultyRow?.deletedAt || (facultyRow as { deleted_at?: unknown })?.deleted_at) {
          await sendUnauthorized(reply, "Session revoked");
          return;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
        request.log.error(
          { err: error, tenant, userId: String(user.id) },
          "Failed to verify account active state; denying request",
        );
        await sendUnauthorized(reply, "Session validation failed");
        return;
      }
    }
  }

  // Server-authoritative inactivity + absolute lifetime enforcement via the Redis
  // session clock for this request.
  markRequestDiagnosticStage(request, "authentication_idle_clock");
  let globalSettings: GlobalSettings | null = null;
  if (globalSettingsCached) {
    try {
      globalSettings = JSON.parse(globalSettingsCached) as GlobalSettings;
    } catch {
      // Fall through on parse failure
    }
  }
  if (!globalSettings) {
    globalSettings = await loadGlobalSettings(tenant);
  }

  const sessionPolicy = tenantSessionPolicy(
    parseSessionTimeoutMinutes(globalSettings.sessionTimeout),
  );
  const idleScope = user.id ? tenantSessionScope(tenant, String(user.id)) : "";

  const idleOutcome = await enforceTenantSessionClock({
    scope: idleScope,
    policy: sessionPolicy,
    jti: user.jti,
    userId: user.id ? String(user.id) : undefined,
  });
  if (idleOutcome !== "ok") {
    const expiry = SESSION_EXPIRY_RESPONSE[idleOutcome];
    await sendUnauthorized(reply, expiry.message, expiry.type);
    return;
  }

  markRequestDiagnosticStage(request, "authentication_workspace_lookup");
  let workspace: Workspace | null = null;
  if (workspaceCached) {
    try {
      workspace = JSON.parse(workspaceCached) as Workspace;
    } catch {
      // Fall through on parse failure
    }
  }
  if (!workspace) {
    workspace = await getWorkspaceBySubdomain(tenant);
  }
  if (!workspace || !isWorkspaceEnabled(workspace)) {
    await reply.status(403).send({
      type: "workspace_disabled",
      message: "This madrasa workspace has been disabled by the platform administrator.",
    });
    return;
  }

  markRequestDiagnosticStage(request, "authentication_claims");
  if (user.workspaceSubdomain?.toLowerCase() !== tenant.toLowerCase()) {
    await sendForbidden(reply, "Token is not valid for this workspace");
    return;
  }

  if (user.tokenType === "refresh") {
    await sendUnauthorized(reply, "Refresh token cannot access this resource");
    return;
  }

  if (user.tokenType === "platform_access") {
    await sendUnauthorized(reply, "Platform session cannot access tenant resources");
    return;
  }

  if (user.twoFactorVerified === false) {
    await reply.status(403).send({
      type: "two_factor_required",
      message: "Two-factor authentication is required to access this resource",
    });
    return;
  }

  // Route handlers read `request.tenant?.id` to open tenant-scoped work
  // (withTenant). Bind it right before completing authentication so any
  // request reaching handlers always has the verified workspace id, never
  // `undefined` (which previously made contract routes bind the tenant
  // string "undefined" and double-transact).
  (request as AuthenticatedRequest).tenant = { id: tenant };

  bindRequestUserId(user.id ? String(user.id) : null);

  const traceparent =
    (request.telemetrySpan ? formatTraceParent(request.telemetrySpan.context) : null) ||
    (typeof request.headers["traceparent"] === "string"
      ? request.headers["traceparent"].trim()
      : null) ||
    undefined;

  bindRequestAuditContext({
    correlationId: traceparent,
    ipAddress: request.ip,
    clientApp:
      typeof request.headers["user-agent"] === "string"
        ? request.headers["user-agent"].slice(0, 64)
        : undefined,
    sessionId: user.jti,
    apiEndpoint: request.url,
    httpMethod: request.method,
  });
}
