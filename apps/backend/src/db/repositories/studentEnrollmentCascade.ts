import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { enrollments } from '../schema.js';
import type { DbClient } from '../dbConnection.js';

import { syncEnrolledSessionsTx } from './enrollmentSessionSync.js';
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
  await tx
    .update(enrollments)
    .set({
      deletedAt,
      deletedBy: deletedBy || null,
      deletionReason: deletionReason
        ? `Cascade: parent student deleted (${deletionReason})`
        : 'Cascade: parent student deleted',
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
 * Caller must already have `app.include_deleted = 'true'`.
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
      ),
    );
  await syncEnrolledSessionsTx(tx, subdomain, { studentIds });
}
