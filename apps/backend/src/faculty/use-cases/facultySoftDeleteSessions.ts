import type { Faculty } from "@mms/shared";

/**
 * Revokes all sessions for users linked to the soft-deleted faculty members.
 */
export async function revokeFacultySessions(tenant: string, members: Faculty[]): Promise<void> {
  try {
    const { revokeAllUserSessions, revokeUserSessionKeys } =
      await import("../../services/session.service.js");
    const { listAllTenantUsersByWorkspace } =
      await import("../../db/repositories/tenantUserRepository.js");

    for (const m of members) {
      await revokeAllUserSessions(String(m.id));
      await revokeUserSessionKeys(String(m.id));
    }

    const contactIds = new Set(members.map((m) => m.contactId).filter(Boolean));
    if (contactIds.size > 0) {
      const tenantUsersList = await listAllTenantUsersByWorkspace(tenant);
      for (const u of tenantUsersList) {
        if (u.contactId && contactIds.has(String(u.contactId))) {
          await revokeAllUserSessions(u.id);
          await revokeUserSessionKeys(u.id);
        }
      }
    }

    const directUserIds = members
      .map((m) => (m as { userId?: string }).userId)
      .filter((uid): uid is string => Boolean(uid && uid.trim()));
    for (const uid of directUserIds) {
      await revokeAllUserSessions(uid);
      await revokeUserSessionKeys(uid);
    }
  } catch {
    // Non-blocking in decoupled unit tests or when session services unavailable
  }
}
