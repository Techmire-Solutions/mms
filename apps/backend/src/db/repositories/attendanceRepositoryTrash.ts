import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { attendance, attendanceLeaves } from "../schema.js";
import { dedupeTrimmedIds, type AttendanceRecord } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { attendanceRecordToInsert as recordToInsert } from "./attendanceRepositoryMappers.js";

/**
 * Attendance soft-delete lifecycle: trash, restore, and the restore-mirror replacement.
 *
 * Split out of `attendanceRepository.ts` for the 300-line band (mms-structure-naming §3) and so the
 * RLS/GUC and collision rules live next to the delete and restore paths they govern
 * (mms-soft-delete §2). Re-exported from `attendanceRepository.js`, which stays the single import
 * surface for adapters and the backup/restore mapping.
 */

/**
 * Hard-deletes the workspace's attendance and re-inserts a snapshot.
 *
 * The DELETE is intentionally raw: `trg_attendance_forbid_hard_delete` (`0108`) blocks it unless
 * the caller's transaction set `app.allow_hard_purge = 'true'` — the restore mirror does exactly
 * that (`services/dbSyncRestoreService.ts`). Never call this outside a restore/backup transaction.
 */
export async function replaceAttendanceRecordsForWorkspace(
  tenant: string,
  records: AttendanceRecord[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  // Dedupe by `id`, NOT by business key: a snapshot legitimately holds a trashed row and a live
  // row for the same student/day, and collapsing them would lose a row on restore.
  const seenIds = new Set<string>();
  const uniqueRecords = records.filter((record) => {
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  await withTenant(subdomain, async (tx) => {
    await tx.delete(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, subdomain));
    await tx.delete(attendance).where(eq(attendance.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(attendance)
        .values(uniqueRecords.map((record) => recordToInsert(subdomain, record)));
    }
  });
}

export async function deleteAttendanceRecordsByWorkspace(tenant: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(attendanceLeaves).where(eq(attendanceLeaves.workspaceSubdomain, subdomain));
    await tx.delete(attendance).where(eq(attendance.workspaceSubdomain, subdomain));
  });
}

export async function bulkSoftDeleteAttendanceRecords(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    // PostgreSQL re-checks an UPDATE's new row against the policy's USING expression, and
    // `deleted_at` is part of it: without this opt-in the soft-delete is rejected as an RLS
    // violation under the production (NONSUPERUSER NOBYPASSRLS) role. Same reason as enrollments.
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(attendance)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        deletedWithCascade: false,
        updatedAt: now,
        version: sql`${attendance.version} + 1`,
      })
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          inArray(attendance.id, uniqueIds),
          isNull(attendance.deletedAt),
        ),
      )
      .returning({ id: attendance.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

/**
 * Restores archived marks, stamping restore provenance.
 *
 * A restore can collide with the partial unique index: a fresh mark may exist for the same
 * (class, student, day) while the old one sat in the trash. Those rows are excluded by the
 * `NOT EXISTS` guard instead of raising `23505` — a collision is "0 restored", never a 500.
 */
export async function bulkRestoreAttendanceRecords(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    // Archived rows are hidden by `tenant_soft_delete_isolation` (FORCE RLS) unless the
    // transaction opts in; without this the UPDATE silently matched zero rows.
    await enableIncludeDeleted(tx);
    try {
      const updated = await tx
        .update(attendance)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt: now,
          restoredBy: userId || null,
          deletedWithCascade: false,
          updatedAt: now,
          version: sql`${attendance.version} + 1`,
        })
        .where(
          and(
            eq(attendance.workspaceSubdomain, subdomain),
            inArray(attendance.id, uniqueIds),
            isNotNull(attendance.deletedAt),
            sql`not exists (
              select 1 from ${attendance} live
               where live.workspace_subdomain = ${attendance.workspaceSubdomain}
                 and live.class_id = ${attendance.classId}
                 and live.student_id = ${attendance.studentId}
                 and live.date_on = ${attendance.date}
                 and live.deleted_at is null
            )`,
          ),
        )
        .returning({ id: attendance.id });

      return {
        succeeded: updated.length,
        failed: uniqueIds.length - updated.length,
      };
    } catch (error) {
      // A concurrent insert can still land between the NOT EXISTS probe and the update; surface it
      // as a conflict rather than a driver error (mms-soft-delete §2 restore error taxonomy).
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "Cannot restore: a live attendance mark already exists for the same student, class and day",
          "attendance_restore_conflict",
        );
      }
      throw error;
    }
  });
}
