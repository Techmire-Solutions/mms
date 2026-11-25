import { and, eq } from "drizzle-orm";
import { withTenant } from "@mms/db/context";
import { tenantUsers } from "@mms/db/schema";
import {
  findTenantUserRowById,
  findTenantUserRowByIdGlobal,
} from "./tenantUserRepositoryHydrate.js";
import { revokeAllUserSessions, revokeUserSessionKeys } from "@mms/be-core/auth/sessionRevocation";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { invalidateMultiTierCache } from "@mms/be-core/cache";

export function tenantUserIdWhere(id: string, workspaceSubdomain: string) {
  return and(
    eq(tenantUsers.id, id),
    eq(tenantUsers.workspaceSubdomain, workspaceSubdomain.trim().toLowerCase()),
  );
}

/**
 * Soft-deletes a tenant user.
 *
 * `workspaceSubdomain` is the CALLER's tenant and is mandatory: the lookup and
 * the UPDATE are both scoped to it, so a caller can never address a user that
 * belongs to another workspace. (Previously the workspace was derived from the
 * fetched row, which — combined with an RLS-bypassing id-only lookup — allowed
 * cross-tenant deletes.)
 */
export async function softDeleteTenantUserRow(
  workspaceSubdomain: string,
  id: string,
  deletedBy: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  await revokeAllUserSessions(id);
  await revokeUserSessionKeys(id);
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: id });
  await invalidateTenantRbac(tenant);
  return true;
}

/** Restores a soft-deleted tenant user. Scoped to the CALLER's workspace. */
export async function restoreTenantUserRow(
  workspaceSubdomain: string,
  id: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || !existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "users", key: id });
  await invalidateTenantRbac(tenant);
  return true;
}

/** Marks a tenant user's email verified. Scoped to the CALLER's workspace. */
export async function verifyTenantUserEmailRow(
  workspaceSubdomain: string,
  id: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/**
 * Platform-admin variant of {@link verifyTenantUserEmailRow}: resolves the
 * target user's own workspace explicitly. Only call from platform routes.
 */
export async function verifyTenantUserEmailRowGlobal(id: string): Promise<boolean> {
  const existing = await findTenantUserRowByIdGlobal(id);
  if (!existing || existing.deletedAt) return false;
  const tenant =
    typeof existing.workspaceSubdomain === "string"
      ? existing.workspaceSubdomain.trim().toLowerCase()
      : "";
  if (!tenant) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/**
 * Replaces an active user's credential and requires a password change at next
 * sign-in. Scoped to the CALLER's workspace.
 */
export async function resetTenantUserPasswordRow(
  workspaceSubdomain: string,
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        passwordHash,
        mustChangePassword: true,
        // An administrator who issues a temporary password has vouched for the
        // address (mirrors create-with-password). Without this, accounts created
        // before that rule — or any unverified account — stay blocked by the
        // workspace email-verification policy no matter how often the password is reset.
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}

/** Sets a self-chosen password from an accepted invite: verifies email, no forced re-change. */
export async function activateInvitedTenantUserRow(
  workspaceSubdomain: string,
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  if (!tenant) return false;
  const existing = await findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  await withTenant(tenant, async (tx) => {
    await tx
      .update(tenantUsers)
      .set({
        passwordHash,
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(tenantUserIdWhere(id, tenant));
  });
  return true;
}
