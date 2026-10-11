import { randomBytes } from "node:crypto";
import type { UsersRepository } from "../repository/usersRepository.js";
import { usersRepository } from "../repository/usersRepositoryAdapter.js";
import { getRequestTenant, requireTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../services/websocketService.js";
import { getHydratedUsers, saveUsers } from "../../services/auth/userService.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { getRawUsers, type PersistedUser } from "../../services/auth/userServiceShared.js";
import { deleteRefreshTokensForUser } from "../../services/auth/authArtifactService.js";
import { sendTenantWelcomeEmail } from "../../services/auth/tenantPasswordOtpService.js";
import { hashPassword } from "../../services/auth/passwordService.js";
import { assertPasswordMeetsPolicy } from "../../services/globalSettingsService.js";
import { loadContactsByIds } from "../../services/contactService.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { findFacultyByContactId } from "../../db/repositories/facultyRepository.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import {
  isFacultyDesignationRoleLocked,
  resolveFacultyContactRoleAssignment,
} from "../../faculty/use-cases/facultyUserRoleGuards.js";
import { upsertFacultyManagedWorkspaceRole } from "../../faculty/use-cases/facultyManagedRolesPrefs.js";
import {
  type WorkspaceUser,
  type UsersListQuery,
  type UsersListPageResult,
  type CreateWorkspaceUserInput,
  type EditWorkspaceUserInput,
  type InviteWorkspaceUserInput,
  normalizeWorkspaceUser,
  workspaceUserListSchema,
  canAssignRole,
  canManageTargetUser,
  collectActiveTenureAssignableRoleIds,
  isFacultyProfileStatus,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  todayISO,
  computeUserInitials,
  createContactLookupMap,
  hydrateWorkspaceUserProfile,
  dedupeTrimmedIds,
  buildFacultyManagedRoleId,
  type FacultyEmployDesignationWriteRow,
} from "@mms/shared";
import { createUserActivityLogService, recordUserActivityLog } from "./userActivityLogUseCases.js";
import {
  executeUserPasswordReset,
  type UserPasswordResetFailureStage,
  type UserPasswordResetAuxiliaryStage,
  type UserPasswordResetAuxiliaryErrorHandler,
  UserPasswordResetError,
  runPasswordResetStage,
  runPasswordResetAuxiliaryStep,
} from "./userPasswordUseCases.js";

export type {
  UserPasswordResetFailureStage,
  UserPasswordResetAuxiliaryStage,
  UserPasswordResetAuxiliaryErrorHandler,
};
export { UserPasswordResetError, runPasswordResetStage, runPasswordResetAuxiliaryStep };

/** Dev-only fallback when a route handler couldn't resolve a trusted request origin. */
const DEFAULT_INVITE_ORIGIN = process.env.PLATFORM_APP_URL?.trim() || "http://localhost:5173";

/**
 * Users use-cases — composition root binding a {@link UsersRepository} to every
 * operation. Production uses the default Drizzle-backed `usersUseCases`; tests
 * can pass a fake repository to exercise orchestration in isolation.
 */
export function createUsersUseCases(repo: UsersRepository = usersRepository) {
  const logService = createUserActivityLogService(repo);

  async function hydrateUserRows(
    rows: Awaited<ReturnType<UsersRepository["listTenantUsersByIds"]>>,
  ): Promise<WorkspaceUser[]> {
    const contactIds = [
      ...new Set(
        rows
          .map((row) => row.contactId)
          .filter((id): id is string | number => id != null && id !== "")
          .map(String),
      ),
    ];
    const contacts = contactIds.length > 0 ? await loadContactsByIds(contactIds) : [];
    const contactMap = createContactLookupMap(contacts);
    return rows.map((row) =>
      normalizeWorkspaceUser(
        hydrateWorkspaceUserProfile(row, contactMap) as Partial<WorkspaceUser>,
      ),
    );
  }

  const loadWorkspaceUsers = async (options?: {
    includeDeleted?: boolean;
  }): Promise<WorkspaceUser[]> => {
    const users = await getHydratedUsers({ includeDeleted: options?.includeDeleted });
    return users.map((u) => normalizeWorkspaceUser(u));
  };

  const assertFacultyRoleAllowed = async (
    tenant: string,
    contactId: string | undefined,
    role: string | undefined,
  ): Promise<void> => {
    if (!contactId || !role) return;
    const faculty = await findFacultyByContactId(tenant, contactId);
    if (!faculty) return;
    const definitions = await listFacultyDesignations(tenant, { limit: null });
    if (!definitions.some((d) => d.status === "active")) return;

    const tenures: FacultyEmployDesignationWriteRow[] =
      Array.isArray(faculty.employDesignations) && faculty.employDesignations.length > 0
        ? faculty.employDesignations
        : faculty.designationId
          ? [
              {
                designationId: String(faculty.designationId),
                designationStartDate: faculty.designationStartDate ?? null,
                designationEndDate: faculty.designationEndDate ?? null,
                employDesignationStatus: isFacultyProfileStatus(faculty.employDesignationStatus)
                  ? faculty.employDesignationStatus
                  : isFacultyProfileStatus(faculty.profileStatus)
                    ? faculty.profileStatus
                    : "active",
                employDesignationId: faculty.employDesignationId ?? null,
              },
            ]
          : [];

    const byId = new Map(definitions.map((d) => [d.id, d]));
    const hasActiveTenure = tenures.some((row) => {
      if (row.employDesignationStatus !== "active") return false;
      if (row.designationEndDate?.trim()) return false;
      const def = byId.get(row.designationId.trim());
      return Boolean(def && def.status === "active");
    });
    if (!hasActiveTenure) {
      throw new HttpDomainError(
        400,
        "faculty_designation_required",
        "Assign an active faculty designation before creating a user account",
      );
    }

    const allowedRoles = collectActiveTenureAssignableRoleIds(tenures, byId);
    // Empty union (all tenures have empty allow-lists) permits any workspace role.
    if (allowedRoles.length === 0) return;
    if (allowedRoles.includes(role)) return;
    // Managed composite role for this contact is the union of allowed catalog roles.
    if (role === buildFacultyManagedRoleId(contactId) && allowedRoles.length > 1) return;
    throw new HttpDomainError(
      400,
      "faculty_role_not_allowed",
      `Role "${role}" is not assignable to the current designation`,
    );
  };

  const createWorkspaceUser = async (
    input: (CreateWorkspaceUserInput | WorkspaceUser) & Record<string, unknown>,
    actorId: string,
    actorRole?: string,
    ip = "127.0.0.1",
    origin?: string,
  ): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }> => {
    const tenant = requireTenant();

    let name = String(input.name || "").trim();
    let email = String(input.email || "")
      .trim()
      .toLowerCase();
    let phone = String(input.phone || "").trim();
    const contactId = input.contactId;
    let effectiveRole = input.role;
    let roleSource: "faculty_designations" | "manual" = "manual";

    if (contactId != null && contactId !== "") {
      const contacts = await loadContactsByIds([String(contactId)]);
      const c = contacts[0];
      if (c) {
        name = name || getDisplayName(c);
        email = email || (getPrimaryEmail(c) || "").toLowerCase();
        phone = phone || getPrimaryPhone(c) || "";
      }

      const assignment = await resolveFacultyContactRoleAssignment(tenant, String(contactId));
      if (assignment && assignment.kind !== "none" && assignment.roleId) {
        if (assignment.kind === "composite" && assignment.composite) {
          await upsertFacultyManagedWorkspaceRole(tenant, assignment.composite);
        }
        effectiveRole = assignment.roleId;
        roleSource = "faculty_designations";
        if (actorRole && !canAssignRole(actorRole, effectiveRole)) {
          throw new HttpDomainError(
            403,
            "forbidden_super_admin_assignment",
            "Only Super Admin can assign the Super Admin role",
          );
        }
      }
    }

    if (actorRole && !canAssignRole(actorRole, effectiveRole)) {
      throw new HttpDomainError(
        403,
        "forbidden_super_admin_assignment",
        "Only Super Admin can assign the Super Admin role",
      );
    }

    await assertFacultyRoleAllowed(
      tenant,
      contactId != null ? String(contactId) : undefined,
      effectiveRole,
    );

    if (!email) {
      throw new HttpDomainError(400, "validation_error", "User email is required");
    }

    const existing = await getHydratedUsers();
    if (
      existing.some(
        (u) => u.loginEmail?.toLowerCase() === email || u.email?.toLowerCase() === email,
      )
    ) {
      throw new HttpDomainError(
        400,
        "duplicate_user_email",
        `User with email "${email}" already exists`,
      );
    }

    let passwordHash = "";
    let mustChangePassword = false;
    const setupMethod = (input as { setupMethod?: string }).setupMethod;
    const password = (input as { password?: string }).password;
    const forceReset = (input as { forceReset?: boolean }).forceReset;

    if (setupMethod === "password" && password) {
      await assertPasswordMeetsPolicy(password);
      passwordHash = await hashPassword(password);
      mustChangePassword = forceReset !== false;
    } else if (setupMethod === "invite") {
      // No password is collected from the admin — the account gets a random unusable
      // hash and the new person sets their own via the welcome email's OTP flow.
      passwordHash = await hashPassword(randomBytes(32).toString("hex"));
    }

    const userId = "id" in input && input.id ? String(input.id) : randomBytes(8).toString("hex");
    const userRecord: PersistedUser = {
      id: userId,
      contactId: contactId != null ? String(contactId) : undefined,
      name: name || email,
      email,
      loginEmail: email,
      phone,
      role: effectiveRole,
      roleSource,
      status: setupMethod === "invite" ? "inactive" : (input.status ?? "active"),
      twoFactorEnabled: input.twoFactorEnabled ?? false,
      lastLogin: "",
      createdDate: todayISO(),
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      activeSessions: 0,
      avatarInitials: computeUserInitials(name || email),
      passwordHash,
      mustChangePassword,
      workspaceSubdomain: tenant,
    };

    const users = await getRawUsers();
    users.push(userRecord);
    await saveUsers(users);
    await invalidateTenantRbac(tenant);
    await broadcastCollection("users");

    await recordUserActivityLog(
      repo,
      tenant,
      actorId,
      "create",
      `Created user ${name} (${email}) with role ${effectiveRole}`,
      ip,
    );

    const reloaded = await loadWorkspaceUsers();
    const created =
      reloaded.find((u) => String(u.id) === userId) ?? normalizeWorkspaceUser(userRecord);

    let inviteEmailSent: boolean | undefined;
    let inviteEmailError: string | undefined;
    if (setupMethod === "invite" && (input as { sendEmail?: boolean }).sendEmail !== false) {
      // The user row above is already committed — a failure here (SMTP down, transient
      // DB error) must degrade to `inviteEmailSent: false`, never fail the whole create.
      try {
        const dispatch = await sendTenantWelcomeEmail({
          workspaceSubdomain: tenant,
          email,
          name: name || email,
          origin: origin ?? DEFAULT_INVITE_ORIGIN,
        });
        inviteEmailSent = dispatch.sent;
        inviteEmailError = dispatch.error;
      } catch (inviteError: unknown) {
        console.error(`[Invite] Failed to send welcome email for user ${userId}:`, inviteError);
        inviteEmailSent = false;
        inviteEmailError =
          inviteError instanceof Error
            ? inviteError.message
            : "The invite email could not be sent.";
      }
    }

    return { user: created, inviteEmailSent, inviteEmailError };
  };

  const deleteUserById = async (
    id: string,
    deletedBy: string,
    actorRole?: string,
    ip = "127.0.0.1",
  ): Promise<boolean> => {
    if (id === deletedBy) {
      throw new HttpDomainError(400, "self_delete", "Cannot delete your own account");
    }

    // Fail closed: the tenant comes from the request and scopes both the lookup
    // and the write, so a foreign id can never be addressed.
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
  };

  const restoreUserById = async (
    id: string,
    actorRole?: string,
    actorId = "system",
    ip = "127.0.0.1",
  ): Promise<boolean> => {
    const tenant = requireTenant();
    const existing = await repo.findTenantUserRowById(tenant, id);
    if (!existing) return false;

    if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
      throw new HttpDomainError(
        403,
        "forbidden_super_admin_mutation",
        "Cannot restore a Super Admin user account",
      );
    }

    const ok = await repo.restoreTenantUserRow(tenant, id);
    if (ok) {
      await invalidateTenantRbac(tenant);
      await broadcastCollection("users");

      await recordUserActivityLog(
        repo,
        tenant,
        actorId,
        "update",
        `Restored user ${existing.name || id}`,
        ip,
      );
    }
    return ok;
  };

  return {
    loadUsersPage: async (
      query: UsersListQuery & { includeDeleted?: boolean },
    ): Promise<UsersListPageResult> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          users: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 50,
          hasMore: false,
        };
      }
      const page = await repo.listTenantUsersPage(tenant, query);
      const ids = page.rows.map((row) => String(row.id));
      const rows = ids.length > 0 ? await repo.listTenantUsersByIds(tenant, ids) : [];
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
      const users = await hydrateUserRows(ordered);
      return {
        users,
        total: page.total,
        page: page.page,
        limit: page.limit,
        hasMore: page.hasMore,
      };
    },

    loadUsersByIds: async (ids: string[], includeDeleted = false): Promise<WorkspaceUser[]> => {
      const uniqueIds = dedupeTrimmedIds(ids);
      if (uniqueIds.length === 0) return [];
      const tenant = requireTenant();
      const rows = await repo.listTenantUsersByIds(tenant, uniqueIds);
      const filtered = includeDeleted ? rows : rows.filter((r) => !r.deletedAt);
      return hydrateUserRows(filtered);
    },

    loadUserById: async (id: string, includeDeleted = false): Promise<WorkspaceUser | null> => {
      const cleanId = id?.trim();
      if (!cleanId) return null;
      const tenant = requireTenant();
      const rows = await repo.listTenantUsersByIds(tenant, [cleanId]);
      const row = rows[0];
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      const [user] = await hydrateUserRows([row]);
      return user ?? null;
    },

    countUsers: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countTenantUsersActive(tenant);
    },

    loadUsersCommandMetrics: async () => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          total: 0,
          active: 0,
          suspended: 0,
          admins: 0,
          twoFaEnabled: 0,
          activeSessions: 0,
        };
      }
      return repo.aggregateUsersCommandMetrics(tenant);
    },

    // --- Users ---
    loadWorkspaceUsers,

    upsertWorkspaceUsers: async (
      records: WorkspaceUser[],
      actorRole?: string,
    ): Promise<WorkspaceUser[]> => {
      const parsed = workspaceUserListSchema.parse(records);
      const existing = await getHydratedUsers();

      const existingById = new Map(existing.map((u) => [String(u.id), u] as const));
      const updatesById = new Map(parsed.map((u) => [String(u.id), u] as const));

      if (actorRole) {
        for (const update of parsed) {
          const existingUser = existingById.get(String(update.id));
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
      for (const update of parsed) {
        if (!existingById.has(String(update.id))) {
          merged.push(update as PersistedUser);
        }
      }

      await saveUsers(merged);
      await invalidateTenantRbac(requireTenant());
      await broadcastCollection("users");
      return loadWorkspaceUsers();
    },

    createWorkspaceUser,

    updateWorkspaceUser: async (
      id: string,
      input: Partial<EditWorkspaceUserInput> & Record<string, unknown>,
      actorId: string,
      actorRole?: string,
      ip = "127.0.0.1",
    ): Promise<WorkspaceUser> => {
      const tenant = requireTenant();

      const existingRow = await repo.findTenantUserRowById(tenant, id);
      if (!existingRow || existingRow.deletedAt) {
        throw new HttpDomainError(404, "not_found", "User not found");
      }

      if (actorRole && !canManageTargetUser(actorRole, existingRow.role)) {
        throw new HttpDomainError(
          403,
          "forbidden_super_admin_mutation",
          "Cannot modify a Super Admin user account",
        );
      }

      if (input.role && actorRole && !canAssignRole(actorRole, input.role)) {
        throw new HttpDomainError(
          403,
          "forbidden_super_admin_assignment",
          "Only Super Admin can assign the Super Admin role",
        );
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

      for (const [k, v] of Object.entries(input)) {
        if (!["contactId", "role", "status", "twoFactorEnabled", "roleSource"].includes(k)) {
          (target as Record<string, unknown>)[k] = v;
        }
      }

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

      const reloaded = await loadWorkspaceUsers();
      const updated = reloaded.find((u) => String(u.id) === id);
      return updated ?? normalizeWorkspaceUser(target);
    },

    inviteWorkspaceUser: async (
      input: InviteWorkspaceUserInput,
      actorId: string,
      actorRole?: string,
      ip = "127.0.0.1",
      origin?: string,
    ): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }> => {
      return createWorkspaceUser(
        {
          ...input,
          status: input.status ?? "inactive",
          setupMethod: "invite",
          twoFactorEnabled: false,
        },
        actorId,
        actorRole,
        ip,
        origin,
      );
    },

    deleteUserById,

    restoreUserById,

    verifyUserEmailById: async (id: string, actorRole?: string): Promise<boolean> => {
      const tenant = requireTenant();
      const existing = await repo.findTenantUserRowById(tenant, id);
      if (!existing) return false;

      if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
        throw new HttpDomainError(
          403,
          "forbidden_super_admin_mutation",
          "Cannot modify a Super Admin user account",
        );
      }

      const ok = await repo.verifyTenantUserEmailRow(tenant, id);
      if (ok) await broadcastCollection("users");
      return ok;
    },

    resetUserPasswordById: async (
      id: string,
      temporaryPassword: string,
      actorRole?: string,
      actorId = "system",
      ip = "127.0.0.1",
      onAuxiliaryError?: UserPasswordResetAuxiliaryErrorHandler,
    ): Promise<boolean> => {
      return executeUserPasswordReset(repo, {
        id,
        temporaryPassword,
        actorRole,
        actorId,
        ip,
        onAuxiliaryError,
      });
    },

    bulkSoftDeleteUsers: async (
      ids: string[],
      deletedBy: string,
      actorRole?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      let succeeded = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const ok = await deleteUserById(id, deletedBy, actorRole);
          if (ok) succeeded += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { succeeded, failed };
    },

    bulkRestoreUsers: async (
      ids: string[],
      actorRole?: string,
      actorId = "system",
      ip = "127.0.0.1",
    ): Promise<{ succeeded: number; failed: number }> => {
      let succeeded = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const ok = await restoreUserById(id, actorRole, actorId, ip);
          if (ok) succeeded += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { succeeded, failed };
    },

    // --- Activity Logs ---
    loadLogs: logService.loadLogs,
    loadLogById: logService.loadLogById,
    loadLogsByIds: logService.loadLogsByIds,
    saveLog: logService.saveLog,
    upsertLogs: logService.upsertLogs,
  };
}

export const usersUseCases = createUsersUseCases();
