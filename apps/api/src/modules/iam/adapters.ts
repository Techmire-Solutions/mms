import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { type PlatformUserProfile } from "@mms/contracts";
import { withGlobalTenant, withTenant } from "@mms/db/context";
import { tenantUsers, workspaces } from "@mms/db/schema";
import type { IamPorts } from "@mms/mod-iam/backend/tenant";
import { createTenantIamPort } from "@mms/mod-iam/backend/tenant/iamPort";
import { usersUseCases } from "@mms/mod-iam/backend/tenant/use-cases";
import { IamError } from "@mms/mod-iam/shared";
import type {
  IamMemberSummary,
  PlatformIamOrgResult,
  PlatformIamUserResult,
} from "@mms/mod-iam/shared";
import {
  listPlatformUsers,
  insertPlatformActivityLog,
} from "@mms/mod-platform/backend/platform/use-cases";
import { verifyPlatformUserPassword } from "@mms/mod-platform/backend/platform/services";
import { createAuthHandoff } from "../../services/auth/authHandoffService.js";
import { revokeAllUserSessions } from "@mms/be-core/auth/sessionRevocation";
import { recordModernAuditEvent } from "@mms/be-core/audit";

function userSearchWhere(query: string): SQL {
  const pattern = `%${query}%`;
  return and(
    isNull(tenantUsers.deletedAt),
    or(ilike(tenantUsers.name, pattern), ilike(tenantUsers.loginEmail, pattern)),
  ) as SQL;
}

function orgSearchWhere(query: string): SQL {
  const pattern = `%${query}%`;
  return or(ilike(workspaces.subdomain, pattern), ilike(workspaces.madrasaName, pattern)) as SQL;
}

function statusOf(
  profileJson: Record<string, unknown> | null | undefined,
): IamMemberSummary["status"] {
  const status = typeof profileJson?.status === "string" ? profileJson.status : "active";
  return status === "inactive" || status === "suspended" ? status : "active";
}

function toMember(row: {
  id: string;
  name: string;
  loginEmail: string;
  role: string;
  profileJson: Record<string, unknown> | null;
}): IamMemberSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.loginEmail,
    role: row.role,
    status: statusOf(row.profileJson),
    contactId:
      typeof row.profileJson?.contactId === "string" ? row.profileJson.contactId : undefined,
    deletedAt: null,
  };
}

export const iamPorts: IamPorts = {
  tenant: createTenantIamPort(),
  platform: {
    verifyActorPassword: (actorId, password) => verifyPlatformUserPassword(actorId, password),
    listAdmins: () => listPlatformUsers() as Promise<PlatformUserProfile[]>,
    searchUsers: async (query, limit, offset): Promise<PlatformIamUserResult[]> => {
      const rows = await withGlobalTenant(async (tx) =>
        tx
          .select({
            tenant: tenantUsers.workspaceSubdomain,
            id: tenantUsers.id,
            name: tenantUsers.name,
            loginEmail: tenantUsers.loginEmail,
            role: tenantUsers.role,
            profileJson: tenantUsers.profileJson,
          })
          .from(tenantUsers)
          .where(userSearchWhere(query))
          .orderBy(asc(tenantUsers.name))
          .limit(limit)
          .offset(offset),
      );
      return rows.map((row) => ({ tenant: row.tenant, user: toMember(row) }));
    },
    countUsers: async (query) => {
      const [row] = await withGlobalTenant(async (tx) =>
        tx
          .select({ value: sql<number>`count(*)::int` })
          .from(tenantUsers)
          .where(userSearchWhere(query)),
      );
      return row?.value ?? 0;
    },
    searchOrganizations: async (query, limit, offset): Promise<PlatformIamOrgResult[]> => {
      const rows = await withGlobalTenant(async (tx) =>
        tx
          .select({
            subdomain: workspaces.subdomain,
            madrasaName: workspaces.madrasaName,
            enabled: workspaces.enabled,
          })
          .from(workspaces)
          .where(orgSearchWhere(query))
          .orderBy(asc(workspaces.subdomain))
          .limit(limit)
          .offset(offset),
      );
      return rows.map((row) => ({
        subdomain: row.subdomain,
        madrasaName: row.madrasaName,
        enabled: row.enabled ?? true,
      }));
    },
    countOrganizations: async (query) => {
      const [row] = await withGlobalTenant(async (tx) =>
        tx
          .select({ value: sql<number>`count(*)::int` })
          .from(workspaces)
          .where(orgSearchWhere(query)),
      );
      return row?.value ?? 0;
    },
    findTenantUser: async (tenant, userId) => {
      const row = await withGlobalTenant(async (tx) =>
        tx
          .select({
            id: tenantUsers.id,
            name: tenantUsers.name,
            loginEmail: tenantUsers.loginEmail,
            role: tenantUsers.role,
            profileJson: tenantUsers.profileJson,
          })
          .from(tenantUsers)
          .where(and(eq(tenantUsers.workspaceSubdomain, tenant), eq(tenantUsers.id, userId)))
          .limit(1),
      );
      return row[0] ? toMember(row[0]) : null;
    },
    setTenantUserStatus: async (tenant, userId, status) => {
      const current = await iamPorts.platform.findTenantUser(tenant, userId);
      if (!current) throw new IamError("not_found", "Tenant user not found");
      await withGlobalTenant(async (tx) =>
        tx
          .update(tenantUsers)
          .set({
            profileJson: sql`jsonb_set(coalesce(${tenantUsers.profileJson}, '{}'::jsonb), '{status}', ${JSON.stringify(status)}::jsonb)`,
            updatedAt: new Date(),
          })
          .where(and(eq(tenantUsers.workspaceSubdomain, tenant), eq(tenantUsers.id, userId))),
      );
      return { ...current, status };
    },
    insertPlatformActivity: async (input) => {
      await insertPlatformActivityLog({
        userId: input.actor.id,
        userEmail: input.actor.email,
        action: input.action,
        targetResource: input.targetResource,
        targetId: input.targetId,
        metadataMessage: input.metadataMessage,
        ipAddress: input.ip,
      });
      return `platform_activity:${input.action}:${input.targetId}`;
    },
    issueImpersonationHandoff: async ({ user, tenant }) => {
      const loaded = await withTenant(tenant, () => usersUseCases.loadUserById(user.id));
      if (!loaded) throw new IamError("not_found", "Tenant user not found");
      const code = await createAuthHandoff({ user: loaded as never });
      const domain = process.env.MMS_APP_DOMAIN?.trim();
      const base = domain ? `https://${tenant}.${domain}` : `http://${tenant}.localhost:5173`;
      return {
        handoffUrl: `${base}/login?handoff=${code}`,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      };
    },
    revokeTenantUserSessions: async (_tenant, userId) => revokeAllUserSessions(userId),
  },
  audit: {
    recordTenantAudit: async (input) => {
      await recordModernAuditEvent({
        workspaceSubdomain: input.tenant,
        tableName: "tenant_users",
        recordId: input.targetId,
        actionType: "UPDATE",
        realUserId: input.actorId,
        impersonatedUserId: input.impersonatedUserId ?? null,
        newState: input.metadata ?? null,
        minimizeDelta: true,
      });
    },
  },
};
