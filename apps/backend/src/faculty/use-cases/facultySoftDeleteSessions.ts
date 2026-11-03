import type { Faculty } from "@mms/shared";
import { logger } from "../../lib/logger.js";

function stringIds(values: unknown[]): string[] {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter((value): value is string => value.length > 0);
}

/**
 * Revokes all sessions for the user accounts linked to the soft-deleted faculty
 * members. Accepts user ids only — `revokeAllUserSessions` is keyed by user id,
 * so faculty/contact ids must be resolved through `tenant_users` first.
 */
export async function revokeFacultySessions(tenant: string, members: Faculty[]): Promise<void> {
  const facultyIds = stringIds(members.map((m) => m.id));
  try {
    const { revokeAllUserSessions, revokeUserSessionKeys } =
      await import("../../services/authSessionService.js");
    const { listAllTenantUsersByWorkspace } =
      await import("../../db/repositories/tenantUserRepository.js");

    const contactIds = new Set(stringIds(members.map((m) => m.contactId)));
    const userIds = new Set(stringIds(members.map((m) => (m as { userId?: string }).userId)));

    if (contactIds.size > 0) {
      const tenantUsersList = await listAllTenantUsersByWorkspace(tenant);
      for (const user of tenantUsersList) {
        const contactId = user.contactId == null ? "" : String(user.contactId).trim();
        if (contactId && contactIds.has(contactId)) userIds.add(String(user.id));
      }
    }

    for (const userId of userIds) {
      await revokeAllUserSessions(userId);
      await revokeUserSessionKeys(userId);
    }
  } catch (error: unknown) {
    // Session revocation is non-blocking for the delete itself, but a failure
    // leaves a linked account signed in — it must never fail silently.
    logger.error(
      { err: error, tenant, facultyIds },
      "Faculty soft-delete session revocation failed; linked users may still hold sessions",
    );
  }
}
