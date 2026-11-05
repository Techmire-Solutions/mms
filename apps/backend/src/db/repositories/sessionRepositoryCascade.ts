import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { sessions, enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { recordCascadeEvents, returningEnrollmentIds } from "./sessionCascadeEvents.js";

export {
  bulkDeleteSessions,
  bulkRestoreSessions,
  bulkDeleteSessions as bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessions as bulkRestoreSessionsWithCascade,
} from "./sessionRepositoryCascadeBulk.js";

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
            eq(enrollments.sessionId, sessionId),
            isNull(enrollments.deletedAt),
          ),
        ),
    );
    await recordCascadeEvents(tx, {
      subdomain,
      action: "delete",
      sessionIds: [sessionId],
      enrollmentIds: cascaded,
      now,
      actorId: deletedBy,
      deletionReason,
    });
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

    const cascaded = await returningEnrollmentIds(
      tx
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
        ),
    );
    await recordCascadeEvents(tx, {
      subdomain,
      action: "restore",
      sessionIds: [sessionId],
      enrollmentIds: cascaded,
      now,
      actorId: restoredBy,
    });
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
