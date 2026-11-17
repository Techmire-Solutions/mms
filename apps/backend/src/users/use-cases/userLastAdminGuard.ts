import { HttpDomainError } from "../../lib/httpErrors.js";
import { getRawUsers } from "../../services/auth/userServiceShared.js";
import { isAdminRole, isSuperAdminRole } from "@mms/shared";

/** Whether a user is an active administrator (role + non-deleted active status). */
export function isActiveAdmin(user: { role?: unknown; status?: unknown }): boolean {
  const role = typeof user.role === "string" ? user.role : "";
  const status = typeof user.status === "string" && user.status ? user.status : "active";
  return (isAdminRole(role) || isSuperAdminRole(role)) && status === "active";
}

/**
 * Throws when `existing` is the tenant's last active administrator, so a delete,
 * demote or deactivate cannot strand the workspace with no admin who can sign in.
 */
export async function assertNotLastActiveAdmin(
  existing: { role?: unknown; status?: unknown },
  type: "last_admin_delete" | "last_admin_mutation",
): Promise<void> {
  if (!isActiveAdmin(existing)) return;
  const activeAdmins = (await getRawUsers()).filter((u) => isActiveAdmin(u)).length;
  if (activeAdmins <= 1) {
    throw new HttpDomainError(
      403,
      type,
      type === "last_admin_delete"
        ? "Cannot delete the last active administrator"
        : "Cannot demote or deactivate the last active administrator",
    );
  }
}
