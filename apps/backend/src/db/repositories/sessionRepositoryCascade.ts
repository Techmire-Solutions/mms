import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { sessions, enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { recordCascadeEvents, returningEnrollmentIds } from "./sessionCascadeEvents.js";
import { sessionAuditStateTx } from "./sessionAuditState.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";

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
    // `deleted_at` is part of the RLS policy's USING clause and PostgreSQL re-checks the
    // new row, so the soft-delete only works when archived rows are visible.
    await enableIncludeDeleted(tx);
    const oldState = await sessionAuditStateTx(tx, subdomain, sessionId);
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
          deletionReason: (deletionReason
            ? `Cascade: parent session deleted (${deletionReason})`
            : "Cascade: parent session deleted"
          ).slice(0, 500),
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
      ...(oldState ? { oldStates: { [sessionId]: oldState } } : {}),
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
    // Archived sessions are hidden by `tenant_soft_delete_isolation` (FORCE RLS) unless
    // the transaction opts in; without this the restore silently matched zero rows.
    await enableIncludeDeleted(tx);
    const oldState = await sessionAuditStateTx(tx, subdomain, sessionId);
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
            // A student archived after this session was trashed keeps its enrollment
            // trashed; restoring it here would resurrect a link to a deleted student.
            // The student restore re-evaluates this predicate and brings it back then.
            sql`EXISTS (
              SELECT 1 FROM students st
               WHERE st.workspace_subdomain = ${enrollments.workspaceSubdomain}
                 AND st.id = ${enrollments.studentId}
                 AND st.deleted_at IS NULL
            )`,
            // Never create a second live row for the same student/session: the student
            // may have been re-enrolled while this row was trashed.
            sql`NOT EXISTS (
              SELECT 1 FROM enrollments live
               WHERE live.workspace_subdomain = ${enrollments.workspaceSubdomain}
                 AND live.student_id = ${enrollments.studentId}
                 AND live.session_id = ${enrollments.sessionId}
                 AND live.id <> ${enrollments.id}
                 AND live.deleted_at IS NULL
                 AND live.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
            )`,
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
      ...(oldState ? { oldStates: { [sessionId]: oldState } } : {}),
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
