import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { enrollments } from "../schema.js";
import type { DbClient } from "../dbConnection.js";

import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
/**
 * Soft-deletes active enrollments for the given students and marks them as
 * cascade-deleted so restore can reverse only those rows.
 */
export async function cascadeSoftDeleteEnrollmentsForStudents(
  tx: DbClient,
  subdomain: string,
  studentIds: string[],
  deletedBy: string,
  deletionReason: string | undefined,
  deletedAt: Date,
): Promise<void> {
  if (studentIds.length === 0) return;
  // Setting `deleted_at` fails the RLS policy check unless the transaction can see
  // archived rows (the policy's USING clause is re-evaluated on the new row).
  await enableIncludeDeleted(tx);
  const reason = deletionReason
    ? `Cascade: parent student deleted (${deletionReason})`
    : "Cascade: parent student deleted";
  await tx
    .update(enrollments)
    .set({
      deletedAt,
      deletedBy: deletedBy || null,
      // The column is varchar(500); an over-long user reason must not abort the
      // student archive with a 22001.
      deletionReason: reason.slice(0, 500),
      deletedWithCascade: true,
      updatedAt: deletedAt,
    })
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.studentId, studentIds),
        isNull(enrollments.deletedAt),
      ),
    );
  await syncEnrolledSessionsTx(tx, subdomain, { studentIds });
}

/**
 * Restores enrollments that were soft-deleted solely because their student was
 * archived (`deleted_with_cascade = true`). Independent trash enrollments stay deleted.
 * The function opts the caller's transaction into `app.include_deleted` itself.
 *
 * Rows whose session is itself archived stay trashed: restoring them would create an
 * "active" enrollment under a deleted session (the session restore re-evaluates this
 * predicate and brings them back then).
 */
export async function restoreCascadedEnrollmentsForStudents(
  tx: DbClient,
  subdomain: string,
  studentIds: string[],
  restoredBy: string | undefined,
  restoredAt: Date,
): Promise<void> {
  if (studentIds.length === 0) return;
  await tx
    .update(enrollments)
    .set({
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt,
      restoredBy: restoredBy || null,
      deletedWithCascade: false,
      updatedAt: restoredAt,
    })
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.studentId, studentIds),
        isNotNull(enrollments.deletedAt),
        eq(enrollments.deletedWithCascade, true),
        sql`EXISTS (
          SELECT 1 FROM sessions s
           WHERE s.workspace_subdomain = ${enrollments.workspaceSubdomain}
             AND s.id = ${enrollments.sessionId}
             AND s.deleted_at IS NULL
        )`,
        // Restoring must not create a second live row for the same student/session (the
        // student may have been re-enrolled while this row sat in the trash).
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
    );
  await syncEnrolledSessionsTx(tx, subdomain, { studentIds });
}
