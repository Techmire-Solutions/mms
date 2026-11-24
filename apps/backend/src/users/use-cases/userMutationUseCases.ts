import type { UsersRepository } from "../repository/usersRepository.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { getHydratedUsers, saveUsers } from "../../services/auth/userService.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { getRawUsers, type PersistedUser } from "../../services/auth/userServiceShared.js";
import { deleteRefreshTokensForUser } from "../../services/auth/authArtifactService.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { isFacultyDesignationRoleLocked } from "../../faculty/use-cases/facultyUserRoleGuards.js";
import {
  type WorkspaceUser,
  type EditWorkspaceUserInput,
  workspaceUserListSchema,
  normalizeWorkspaceUser,
  canAssignRole,
  canManageTargetUser,
  isAdminRole,
  isPlatformManagedRole,
  isSuperAdminRole,
} from "@mms/contracts";
import { recordUserActivityLog } from "./userActivityLogUseCases.js";
import { assertFacultyRoleAllowed } from "./userCreationUseCases.js";
import { sanitizeBulkUserRow } from "./userBulkUpsertSanitize.js";
import { assertNotLastActiveAdmin } from "./userLastAdminGuard.js";

export async function deleteUserByIdHelper(
  repo: UsersRepository,
  id: string,
  deletedBy: string,
  actorRole?: string,
  ip = "127.0.0.1",
): Promise<boolean> {
  if (id === deletedBy) {
    throw new HttpDomainError(400, "self_delete", "Cannot delete your own account");
  }
  const tenant = requireTenant();
  const existing = await repo.findTenantUserRowById(tenant, id);
  if (!existing || existing.deletedAt) return false;

  if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_deletion",
      "Cannot delete a Super Admin user account",
    );
  }

  // Never delete the tenant's last active administrator.
  await assertNotLastActiveAdmin(existing, "last_admin_delete");

  const ok = await repo.softDeleteTenantUserRow(tenant, id, deletedBy);
  if (ok) {
    await deleteRefreshTokensForUser(id);
    await invalidateTenantRbac(tenant);
    await broadcastCollection("users");

    await recordUserActivityLog(
      repo,
      tenant,
      deletedBy,
      "delete",
      `Deleted user ${existing.name || id}`,
      ip,
    );
  }
  return ok;
}

export async function upsertWorkspaceUsersHelper(
  records: WorkspaceUser[],
  actorRole?: string,
  loadWorkspaceUsers?: () => Promise<WorkspaceUser[]>,
  actorId?: string,
): Promise<WorkspaceUser[]> {
  const parsed = workspaceUserListSchema.parse(records);
  // Authoritative allowlist: strip credential/lifecycle fields before any merge
  // or save, so even a non-contract caller cannot inject them.
  const sanitized = parsed.map((row) =>
    sanitizeBulkUserRow(row as WorkspaceUser & Record<string, unknown>),
  );
  const existing = await getHydratedUsers();

  const existingById = new Map(existing.map((u) => [String(u.id), u] as const));
  const updatesById = new Map(sanitized.map((u) => [String(u.id), u] as const));

  for (const update of sanitized) {
    const existingUser = existingById.get(String(update.id));

    // The apex tenant account is platform-owned: bulk upserts may neither create it
    // nor change its role.
    if (isPlatformManagedRole(update.role) && update.role !== existingUser?.role) {
      throw new HttpDomainError(
        403,
        "platform_managed_role",
        "The Super Admin role can only be assigned from the platform console",
      );
    }
    if (
      existingUser &&
      isPlatformManagedRole(existingUser.role) &&
      update.role !== existingUser.role
    ) {
      throw new HttpDomainError(
        403,
        "platform_managed_role",
        "This account is managed from the platform console",
      );
    }

    if (actorId && String(update.id) === String(actorId)) {
      if (update.role !== undefined && update.role !== existingUser?.role) {
        throw new HttpDomainError(
          400,
          "self_role_change",
          "Use profile settings to change your own role",
        );
      }
      if (update.status !== undefined && update.status !== "active") {
        throw new HttpDomainError(
          400,
          "self_status_change",
          "Use profile settings to change your own status",
        );
      }
    }

    if (actorRole) {
      if (existingUser && !canManageTargetUser(actorRole, existingUser.role)) {
        throw new HttpDomainError(
          403,
          "forbidden_super_admin_mutation",
          "Cannot modify a Super Admin user account",
        );
      }
      if (update.role && !canAssignRole(actorRole, update.role)) {
        throw new HttpDomainError(
          403,
          "forbidden_super_admin_assignment",
          "Only Super Admin can assign the Super Admin role",
        );
      }
    }
  }

  const merged: PersistedUser[] = existing.map((u) => {
    const update = updatesById.get(String(u.id));
    return update ? ({ ...u, ...update } as PersistedUser) : u;
  });
  for (const update of sanitized) {
    if (!existingById.has(String(update.id))) {
      merged.push(update as PersistedUser);
    }
  }

  await saveUsers(merged);
  await invalidateTenantRbac(requireTenant());
  await broadcastCollection("users");
  return loadWorkspaceUsers ? loadWorkspaceUsers() : [];
}

export async function updateWorkspaceUserHelper(
  repo: UsersRepository,
  id: string,
  input: Partial<EditWorkspaceUserInput> & Record<string, unknown>,
  actorId: string,
  actorRole?: string,
  ip = "127.0.0.1",
  loadWorkspaceUsers?: () => Promise<WorkspaceUser[]>,
): Promise<WorkspaceUser> {
  const tenant = requireTenant();
  const existingRow = await repo.findTenantUserRowById(tenant, id);
  if (!existingRow || existingRow.deletedAt) {
    throw new HttpDomainError(404, "not_found", "User not found");
  }

  // Self-protection: an administrator cannot change their own role or move their
  // own account off "active" through the admin endpoint (mirrors self-delete and
  // self-reset-password guards).
  if (String(id) === String(actorId)) {
    if (input.role !== undefined && input.role !== existingRow.role) {
      throw new HttpDomainError(
        400,
        "self_role_change",
        "Use profile settings to change your own role",
      );
    }
    if (input.status !== undefined && input.status !== "active") {
      throw new HttpDomainError(
        400,
        "self_status_change",
        "Use profile settings to change your own status",
      );
    }
  }

  if (actorRole && !canManageTargetUser(actorRole, existingRow.role)) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_mutation",
      "Cannot modify a Super Admin user account",
    );
  }

  if (input.role !== undefined && input.role !== existingRow.role) {
    if (isPlatformManagedRole(input.role) || isPlatformManagedRole(existingRow.role)) {
      throw new HttpDomainError(
        403,
        "platform_managed_role",
        "The Super Admin role is managed from the platform console",
      );
    }
  }
  if (
    input.role &&
    input.role !== existingRow.role &&
    actorRole &&
    !canAssignRole(actorRole, input.role)
  ) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_assignment",
      "Only Super Admin can assign the Super Admin role",
    );
  }

  // Never demote or deactivate the tenant's last active administrator.
  const removesActiveAdmin =
    (input.role !== undefined && !isAdminRole(input.role) && !isSuperAdminRole(input.role)) ||
    (input.status !== undefined && input.status !== "active");
  if (removesActiveAdmin) {
    await assertNotLastActiveAdmin(existingRow, "last_admin_mutation");
  }

  const effectiveContactId =
    input.contactId !== undefined
      ? input.contactId != null && input.contactId !== ""
        ? String(input.contactId)
        : undefined
      : existingRow.contactId
        ? String(existingRow.contactId)
        : undefined;

  const roleLocked = await isFacultyDesignationRoleLocked(tenant, effectiveContactId);
  if (roleLocked && input.role !== undefined && input.role !== existingRow.role) {
    throw new HttpDomainError(
      403,
      "faculty_role_locked",
      "Role is managed by faculty designations and cannot be changed manually",
    );
  }

  await assertFacultyRoleAllowed(
    tenant,
    effectiveContactId,
    roleLocked ? existingRow.role : (input.role ?? existingRow.role),
  );

  const rawUsers = await getRawUsers();
  const target = rawUsers.find((u) => String(u.id) === id);
  if (!target) {
    throw new HttpDomainError(404, "not_found", "User not found");
  }

  if (input.contactId !== undefined) {
    target.contactId =
      input.contactId != null && input.contactId !== "" ? String(input.contactId) : undefined;
  }
  if (input.role !== undefined && !roleLocked) {
    target.role = input.role;
    (target as Record<string, unknown>).roleSource = "manual";
  }
  if (roleLocked) {
    (target as Record<string, unknown>).roleSource = "faculty_designations";
  }
  if (input.status !== undefined) target.status = input.status;
  if (input.twoFactorEnabled !== undefined) target.twoFactorEnabled = input.twoFactorEnabled;

  await saveUsers(rawUsers);
  await invalidateTenantRbac(tenant);
  await broadcastCollection("users");

  await recordUserActivityLog(
    repo,
    tenant,
    actorId,
    "update",
    `Updated user ${target.name || id}`,
    ip,
  );

  const reloaded = loadWorkspaceUsers ? await loadWorkspaceUsers() : [];
  const updated = reloaded.find((u) => String(u.id) === id);
  return updated ?? normalizeWorkspaceUser(target);
}
