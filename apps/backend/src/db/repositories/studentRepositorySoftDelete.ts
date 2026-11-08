import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { students } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import {
  cascadeSoftDeleteEnrollmentsForStudents,
  restoreCascadedEnrollmentsForStudents,
} from "./studentEnrollmentCascade.js";

/**
 * Single-statement atomic bulk soft-delete for students (per mms-data-layer.md §6.9).
 */
export async function bulkSoftDeleteStudentsSql(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  const res = await withTenant(subdomain, async (tx) => {
    // `deleted_at` participates in the RLS policy's USING clause, so the new row fails
    // the policy check unless archived rows are visible in this transaction.
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(students)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          inArray(students.id, uniqueIds),
          isNull(students.deletedAt),
        ),
      )
      .returning({ id: students.id });

    // The enrollment cascade belongs to the student write, not to the use case: any
    // caller of this primitive now archives the dependent enrollments atomically, so a
    // future direct caller cannot leave live enrollments pointing at an archived student.
    await cascadeSoftDeleteEnrollmentsForStudents(
      tx,
      subdomain,
      updated.map((row) => String(row.id)),
      deletedBy ?? "",
      deletionReason,
      now,
    );

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "students" });
  return res;
}

/**
 * Single-statement atomic bulk restore for students (per mms-data-layer.md §6.9).
 */
export async function bulkRestoreStudentsSql(
  tenant: string,
  ids: string[],
  userId?: string,
  restoredAt?: Date,
): Promise<{ succeeded: number; failed: number; restoredIds: string[] }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0, restoredIds: [] };
  // One caller-supplied instant for the whole batch: rows, cascade and audit
  // must not carry three different `restoredAt` values.
  const now = restoredAt ?? new Date();
  const res = await withTenant(subdomain, async (tx) => {
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(students)
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
          eq(students.workspaceSubdomain, subdomain),
          inArray(students.id, uniqueIds),
          isNotNull(students.deletedAt),
        ),
      )
      .returning({ id: students.id });

    const restoredIds = updated.map((row) => String(row.id));
    if (restoredIds.length > 0) {
      // Same reasoning as the delete primitive: the dependent cascade is part of the
      // parent write, so a direct caller can never resurrect a student without its
      // cascade-archived enrollments.
      await restoreCascadedEnrollmentsForStudents(tx, subdomain, restoredIds, userId, now);
    }

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
      restoredIds,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "students" });
  return res;
}
