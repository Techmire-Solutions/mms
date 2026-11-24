import type { FastifyReply, FastifyRequest } from "fastify";
import type { GlobalSettings, User, Workspace } from "@mms/contracts";
import { isWorkspaceEnabled } from "@mms/contracts";
import { bindRequestTenant, getRequestTenant } from "@mms/db/request-context";
import type { SpanContext } from "../telemetry/index.js";
import { bindAuthenticatedRequestContext } from "./bindContext.js";
import { resolveSubdomainFromRequest } from "../http/tenantContext.js";
import {
  rejectOnAuthDependencyFailure,
  enforceSessionClockOrReply,
  type SessionClockCheck,
  type SessionClockOutcome,
  type SessionTimeoutPolicy,
} from "./session.js";
import {
  sendForbidden,
  sendTwoFactorRequired,
  sendUnauthorized,
  sendWorkspaceDisabled,
} from "./responses.js";
import { verifyJwtOrUnauthorized } from "./verification.js";

export interface TenantClaims extends User {
  twoFactorVerified?: boolean;
  tokenType?: string;
  jti?: string;
  iat?: number;
  iat_ms?: number;
  exp?: number;
}

/** Minimal request surface the guard reads; Fastify requests satisfy it structurally. */
export interface TenantAuthRequest {
  user?: TenantClaims;
  tenant?: { id: string };
  telemetrySpan?: { context: SpanContext };
}

export interface TenantAuthPipelineSnapshot {
  tenantBlocked: boolean;
  tokenRevoked: boolean;
  userSessionRevoked: boolean;
  globalSettingsCached?: string;
  workspaceCached?: string;
}

export interface TenantAuthSessionPorts {
  /** Runs the batched Redis/DB auth pipeline (blocklist, revocation, caches). */
  readAuthPipeline(args: {
    tenant: string;
    jti?: string;
    userId?: string;
    role?: string;
    issuedAtMs?: number;
  }): Promise<TenantAuthPipelineSnapshot>;
  /** True when the error is the fail-closed auth-dependency outage signal. */
  isDependencyUnavailable(error: unknown): boolean;
  /** Authoritative role from the tenant role matrix, or null when removed. */
  resolveAuthoritativeRole(
    tenant: string,
    userId: string,
  ): Promise<{ role?: string; deletedAt?: unknown } | null>;
  /** Attaches tenant-authored role catalogs for custom/composite roles. */
  attachRoleCatalog?(user: TenantClaims, tenant: string): Promise<void>;
  /** Faculty soft-delete check (account must not retain access). */
  isAccountSoftDeleted(tenant: string, userId: string): Promise<boolean>;
  loadGlobalSettings(tenant: string): Promise<GlobalSettings>;
  sessionPolicyFor(settings: GlobalSettings): SessionTimeoutPolicy;
  enforceSessionClock(check: SessionClockCheck): Promise<SessionClockOutcome>;
  loadWorkspace(tenant: string): Promise<Workspace | null>;
  /** Optional perf/diagnostic stage marker (app request diagnostics). */
  markStage?(request: FastifyRequest, stage: string): void;
  /** Optional unexpected-error hook; defaults to a no-op. */
  onUnexpectedError?(
    request: FastifyRequest,
    error: unknown,
    meta: { tenant: string; userId?: string },
  ): void;
}

export type TenantAuthGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

/**
 * Builds the tenant authentication preHandler.
 *
 * The ordering and response envelopes are the contract: JWT → tenant → Redis
 * pipeline (blocklist/revocation) → soft-deleted account/role → session clock →
 * workspace enablement → token-type/2FA claims → bind request context. Every
 * dependency that can fail closed is injected; the package never imports app
 * services or domain modules.
 */
export function createTenantAuthGuard(ports: TenantAuthSessionPorts): TenantAuthGuard {
  return async function tenantAuthGuard(request, reply): Promise<void> {
    if (reply.sent) return;
    ports.markStage?.(request, "authentication_jwt");
    if (
      !(await verifyJwtOrUnauthorized(request as unknown as { jwtVerify(): Promise<void> }, reply))
    )
      return;

    const user = (request as unknown as TenantAuthRequest).user as TenantClaims;
    ports.markStage?.(request, "authentication_tenant_context");
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

    ports.markStage?.(request, "authentication_tenant_blocklist");
    let authPipeline: TenantAuthPipelineSnapshot;
    try {
      authPipeline = await ports.readAuthPipeline({
        tenant,
        jti: user.jti,
        userId: user.id ? String(user.id) : undefined,
        role: user.role,
        issuedAtMs: user.iat_ms ?? (user.iat ? user.iat * 1000 : undefined),
      });
    } catch (error) {
      if (
        await rejectOnAuthDependencyFailure(reply, error, "tenant", ports.isDependencyUnavailable)
      ) {
        return;
      }
      throw error;
    }
    const {
      tenantBlocked,
      tokenRevoked,
      userSessionRevoked,
      globalSettingsCached,
      workspaceCached,
    } = authPipeline;
    if (tenantBlocked) {
      await sendWorkspaceDisabled(reply);
      return;
    }

    ports.markStage?.(request, "authentication_token_revocation");
    if (tokenRevoked) {
      await sendUnauthorized(reply, "Session revoked");
      return;
    }

    ports.markStage?.(request, "authentication_user_session_revocation");
    if (userSessionRevoked) {
      await sendUnauthorized(reply, "Session revoked");
      return;
    }

    // Soft-deleted accounts must not retain access or active sessions.
    ports.markStage?.(request, "authentication_account_active");
    const userClaims = user as unknown as { deletedAt?: unknown; deleted_at?: unknown };
    if (userClaims.deletedAt || userClaims.deleted_at) {
      await sendUnauthorized(reply, "Session revoked");
      return;
    }

    if (user.id) {
      try {
        const userStatus = await ports.resolveAuthoritativeRole(tenant, String(user.id));
        if (!userStatus || userStatus.deletedAt) {
          await sendUnauthorized(reply, "Session revoked");
          return;
        }
        // Replace the potentially stale JWT role with the authoritative matrix
        // role so downstream permission checks reflect role changes immediately.
        if (userStatus.role) {
          user.role = userStatus.role;
        }
        await ports.attachRoleCatalog?.(user, tenant);
        if (await ports.isAccountSoftDeleted(tenant, String(user.id))) {
          await sendUnauthorized(reply, "Session revoked");
          return;
        }
      } catch (error) {
        if (!isTestRuntime()) {
          ports.onUnexpectedError?.(request, error, {
            tenant,
            userId: user.id ? String(user.id) : undefined,
          });
          await sendUnauthorized(reply, "Session validation failed");
          return;
        }
      }
    }

    ports.markStage?.(request, "authentication_idle_clock");
    let globalSettings: GlobalSettings | null = null;
    if (globalSettingsCached) {
      try {
        globalSettings = JSON.parse(globalSettingsCached) as GlobalSettings;
      } catch {
        // Fall through on parse failure.
      }
    }
    if (!globalSettings) {
      globalSettings = await ports.loadGlobalSettings(tenant);
    }

    const sessionPolicy = ports.sessionPolicyFor(globalSettings);
    const idleScope = user.id ? tenantSessionScope(tenant, String(user.id)) : "";

    const clockOk = await enforceSessionClockOrReply(request, reply, {
      scope: idleScope,
      policy: sessionPolicy,
      jti: user.jti,
      userId: user.id ? String(user.id) : undefined,
      enforce: ports.enforceSessionClock,
      domain: "tenant",
      isDependencyUnavailable: ports.isDependencyUnavailable,
    });
    if (!clockOk) return;

    ports.markStage?.(request, "authentication_workspace_lookup");
    let workspace: Workspace | null = null;
    if (workspaceCached) {
      try {
        workspace = JSON.parse(workspaceCached) as Workspace;
      } catch {
        // Fall through on parse failure.
      }
    }
    if (!workspace) {
      workspace = await ports.loadWorkspace(tenant);
    }
    if (!workspace || !isWorkspaceEnabled(workspace)) {
      await sendWorkspaceDisabled(reply);
      return;
    }

    ports.markStage?.(request, "authentication_claims");
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
      await sendTwoFactorRequired(reply);
      return;
    }

    // Route handlers read `request.tenant?.id` to open tenant-scoped work.
    (request as TenantAuthRequest).tenant = { id: tenant };

    bindAuthenticatedRequestContext(
      request,
      { id: user.id, jti: user.jti },
      (request as TenantAuthRequest).telemetrySpan,
    );
  };
}

/** Tenant session clock scope (kept in the kernel so guards do not import app services). */
export function tenantSessionScope(subdomain: string, userId: string): string {
  return `tn:${subdomain.trim().toLowerCase()}:${userId}`;
}
