import type { FastifyRequest } from "fastify";
import type { GlobalSettings, User } from "@mms/contracts";
import { parseSessionTimeoutMinutes } from "@mms/contracts";
import { createTenantAuthGuard, type TenantAuthGuard } from "@mms/be-core/auth";
import { tenantSessionPolicy } from "@mms/mod-sessions/backend/services";
import { enforceTenantSessionClock } from "@mms/mod-sessions/backend/services";
import { markRequestDiagnosticStage } from "../lib/requestDiagnostics.js";
import { getWorkspaceBySubdomain } from "../services/workspaceService.js";
import { loadGlobalSettings } from "../services/globalSettingsService.js";
import { attachTenantRoleCatalog } from "../lib/attachTenantRoleCatalog.js";
import { isAuthDependencyUnavailable } from "../lib/authGuard.js";
import { checkTenantAuthPipelineBatch } from "@mms/be-core/auth/sessionRevocation";
import { isAccountDeleted } from "./accountDeletionGuard.js";

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

const guard: TenantAuthGuard = createTenantAuthGuard({
  readAuthPipeline: async (args) => {
    const batch = await checkTenantAuthPipelineBatch(args);
    return {
      ...batch,
      globalSettingsCached: batch.globalSettingsCached ?? undefined,
      workspaceCached: batch.workspaceCached ?? undefined,
    };
  },
  isDependencyUnavailable: isAuthDependencyUnavailable,
  resolveAuthoritativeRole: async (tenant, userId) => {
    const { getTenantRoleMatrix } = await import("../services/rbacService.js");
    const matrix = await getTenantRoleMatrix(tenant);
    const entry = matrix[userId];
    return entry ? { role: entry.role, deletedAt: entry.deletedAt } : null;
  },
  attachRoleCatalog: (user, tenant) => attachTenantRoleCatalog(user as User, tenant),
  // Bound by the composition root (modules/faculty/adapters.ts → routes/index.ts).
  // Fail-closed when unconfigured; see middleware/accountDeletionGuard.ts.
  isAccountSoftDeleted: isAccountDeleted,
  loadGlobalSettings: (tenant) => loadGlobalSettings(tenant),
  sessionPolicyFor: (settings: GlobalSettings) =>
    tenantSessionPolicy(parseSessionTimeoutMinutes(settings.sessionTimeout)),
  enforceSessionClock: enforceTenantSessionClock,
  loadWorkspace: (tenant) => getWorkspaceBySubdomain(tenant),
  markStage: markRequestDiagnosticStage,
  onUnexpectedError: (request, error, meta) => {
    request.log.error(
      { err: error, ...meta },
      "Failed to verify account active state; denying request",
    );
  },
});

/** Verifies JWT (cookie or Authorization header) and binds the token workspace to the request host. */
export const authenticateTenant: TenantAuthGuard = guard;
/** Canonical name for the extracted tenant-context injection guard. */
export const tenantAuthGuard: TenantAuthGuard = guard;
