import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { sessions, enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";

import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
export async function softDeleteSessionWithCascade(
  tenant: string,
  sessionId: string,
  deletedBy?: string,
  deletionReason?: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          eq(sessions.id, sessionId),
          isNull(sessions.deletedAt),
        ),
      )
      .for("update");

    const sessionRes = await tx
      .update(sessions)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          eq(sessions.id, sessionId),
          isNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    if (sessionRes.length === 0) {
      return false;
    }

    await tx
      .update(enrollments)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason
          ? `Cascade: parent session deleted (${deletionReason})`
          : "Cascade: parent session deleted",
        deletedWithCascade: true,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, sessionId),
          isNull(enrollments.deletedAt),
        ),
      );
    await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: [sessionId] });

    return true;
  });
}

export async function restoreSessionWithCascade(
  tenant: string,
  sessionId: string,
  restoredBy?: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          eq(sessions.id, sessionId),
          isNotNull(sessions.deletedAt),
        ),
      )
      .for("update");

    const sessionRes = await tx
      .update(sessions)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: restoredBy || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          eq(sessions.id, sessionId),
          isNotNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    if (sessionRes.length === 0) {
      return false;
    }

    await tx
      .update(enrollments)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: restoredBy || null,
        deletedWithCascade: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, sessionId),
          isNotNull(enrollments.deletedAt),
          eq(enrollments.deletedWithCascade, true),
        ),
      );
    await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: [sessionId] });

    return true;
  });
}

export async function hardDeleteSession(tenant: string, sessionId: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    const res = await tx
      .delete(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, sessionId)))
      .returning({ id: sessions.id });
    return res.length > 0;
  });
}

export async function bulkDeleteSessions(
  tenant: string,
  sessionIds: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  if (sessionIds.length === 0) return { succeeded: 0, failed: 0 };
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const res = await tx
      .update(sessions)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, sessionIds),
          isNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    const deletedIds = res.map((r) => r.id);
    if (deletedIds.length > 0) {
      await tx
        .update(enrollments)
        .set({
          deletedAt: now,
          deletedBy: deletedBy || null,
          deletionReason: deletionReason
            ? `Cascade: parent session deleted (${deletionReason})`
            : "Cascade: parent session deleted",
          deletedWithCascade: true,
          updatedAt: now,
        })
        .where(
          and(
            eq(enrollments.workspaceSubdomain, subdomain),
            inArray(enrollments.sessionId, deletedIds),
            isNull(enrollments.deletedAt),
          ),
        );
      await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: deletedIds });
    }

    const succeeded = res.length;
    const failed = Math.max(0, sessionIds.length - succeeded);
    return { succeeded, failed };
  });
}

export async function bulkRestoreSessions(
  tenant: string,
  sessionIds: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  if (sessionIds.length === 0) return { succeeded: 0, failed: 0 };
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const res = await tx
      .update(sessions)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: userId || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, sessionIds),
          isNotNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    const restoredIds = res.map((r) => r.id);
    if (restoredIds.length > 0) {
      await tx
        .update(enrollments)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt: now,
          restoredBy: userId || null,
          deletedWithCascade: false,
          updatedAt: now,
        })
        .where(
          and(
            eq(enrollments.workspaceSubdomain, subdomain),
            inArray(enrollments.sessionId, restoredIds),
            isNotNull(enrollments.deletedAt),
            eq(enrollments.deletedWithCascade, true),
          ),
        );
      await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: restoredIds });
    }

    const succeeded = res.length;
    const failed = Math.max(0, sessionIds.length - succeeded);
    return { succeeded, failed };
  });
}

export {
  bulkDeleteSessions as bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessions as bulkRestoreSessionsWithCascade,
};
