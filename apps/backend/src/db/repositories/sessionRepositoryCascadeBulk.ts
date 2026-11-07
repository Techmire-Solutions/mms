import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { sessions, enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { recordCascadeEvents, returningEnrollmentIds } from "./sessionCascadeEvents.js";

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
    const before = await tx
      .select({
        id: sessions.id,
        status: sessions.status,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        version: sessions.version,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, sessionIds),
          isNull(sessions.deletedAt),
        ),
      );
    const oldStates = Object.fromEntries(
      before.map((row) => [row.id, { ...row, version: Number(row.version) }]),
    );
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
      const cascaded = await returningEnrollmentIds(
        tx
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
          ),
      );
      await recordCascadeEvents(tx, {
        subdomain,
        action: "delete",
        sessionIds: deletedIds,
        enrollmentIds: cascaded,
        now,
        actorId: deletedBy,
        deletionReason,
        oldStates,
      });
      await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: deletedIds });
    }

    return {
      succeeded: res.length,
      failed: Math.max(0, sessionIds.length - res.length),
    };
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
    const before = await tx
      .select({
        id: sessions.id,
        status: sessions.status,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        version: sessions.version,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, sessionIds),
          isNotNull(sessions.deletedAt),
        ),
      );
    const oldStates = Object.fromEntries(
      before.map((row) => [row.id, { ...row, version: Number(row.version) }]),
    );
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
      const cascaded = await returningEnrollmentIds(
        tx
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
          ),
      );
      await recordCascadeEvents(tx, {
        subdomain,
        action: "restore",
        sessionIds: restoredIds,
        enrollmentIds: cascaded,
        now,
        actorId: userId,
        oldStates,
      });
      await syncEnrolledSessionsTx(tx, subdomain, { sessionIds: restoredIds });
    }

    return {
      succeeded: res.length,
      failed: Math.max(0, sessionIds.length - res.length),
    };
  });
}
