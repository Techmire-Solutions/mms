import { randomBytes } from "node:crypto";
import type { UsersRepository } from "../repository/usersRepository.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { getHydratedUsers, saveUsers } from "../../services/auth/userService.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { getRawUsers, type PersistedUser } from "../../services/auth/userServiceShared.js";
import { sendTenantWelcomeEmail } from "../../services/auth/tenantPasswordOtpDispatch.js";
import { hashPassword } from "../../services/auth/passwordService.js";
import { assertPasswordMeetsPolicy } from "../../services/globalSettingsService.js";
import { loadContactsByIds } from "../../services/contactService.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { findFacultyByContactId } from "../../db/repositories/facultyRepository.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import { resolveFacultyContactRoleAssignment } from "../../faculty/use-cases/facultyUserRoleGuards.js";
import { upsertFacultyManagedWorkspaceRole } from "../../faculty/use-cases/facultyManagedRolesPrefs.js";
import {
  type WorkspaceUser,
  type CreateWorkspaceUserInput,
  type InviteWorkspaceUserInput,
  normalizeWorkspaceUser,
  canAssignRole,
  collectActiveTenureAssignableRoleIds,
  isFacultyProfileStatus,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  todayISO,
  computeUserInitials,
  buildFacultyManagedRoleId,
  type FacultyEmployDesignationWriteRow,
} from "@mms/shared";
import { recordUserActivityLog } from "./userActivityLogUseCases.js";

/** Dev-only fallback when a route handler couldn't resolve a trusted request origin. */
const DEFAULT_INVITE_ORIGIN = process.env.PLATFORM_APP_URL?.trim() || "http://localhost:5173";

export async function assertFacultyRoleAllowed(
  tenant: string,
  contactId: string | undefined,
  role: string | undefined,
): Promise<void> {
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
  if (allowedRoles.length === 0) return;
  if (allowedRoles.includes(role)) return;
  if (role === buildFacultyManagedRoleId(contactId) && allowedRoles.length > 1) return;
  throw new HttpDomainError(
    400,
    "faculty_role_not_allowed",
    `Role "${role}" is not assignable to the current designation`,
  );
}

export async function createWorkspaceUserHelper(
  repo: UsersRepository,
  input: (CreateWorkspaceUserInput | WorkspaceUser) & Record<string, unknown>,
  actorId: string,
  actorRole?: string,
  ip = "127.0.0.1",
  origin?: string,
  loadWorkspaceUsers?: () => Promise<WorkspaceUser[]>,
): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }> {
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
    existing.some((u) => u.loginEmail?.toLowerCase() === email || u.email?.toLowerCase() === email)
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

  const reloaded = loadWorkspaceUsers ? await loadWorkspaceUsers() : [];
  const created =
    reloaded.find((u) => String(u.id) === userId) ?? normalizeWorkspaceUser(userRecord);

  let inviteEmailSent: boolean | undefined;
  let inviteEmailError: string | undefined;
  if (setupMethod === "invite" && (input as { sendEmail?: boolean }).sendEmail !== false) {
    try {
      const dispatch = await sendTenantWelcomeEmail({
        workspaceSubdomain: tenant,
        email,
        name: name || email,
        origin: origin ?? DEFAULT_INVITE_ORIGIN,
        phone: phone || (input as { phone?: string }).phone,
      });
      inviteEmailSent = dispatch.sent;
      inviteEmailError = dispatch.error;
    } catch (inviteError: unknown) {
      console.error(`[Invite] Failed to send welcome email for user ${userId}:`, inviteError);
      inviteEmailSent = false;
      inviteEmailError =
        inviteError instanceof Error ? inviteError.message : "The invite email could not be sent.";
    }
  }

  return { user: created, inviteEmailSent, inviteEmailError };
}

export async function inviteWorkspaceUserHelper(
  createFn: (
    input: (CreateWorkspaceUserInput | WorkspaceUser) & Record<string, unknown>,
    actorId: string,
    actorRole?: string,
    ip?: string,
    origin?: string,
  ) => Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }>,
  input: InviteWorkspaceUserInput,
  actorId: string,
  actorRole?: string,
  ip = "127.0.0.1",
  origin?: string,
): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }> {
  return createFn(
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
}
