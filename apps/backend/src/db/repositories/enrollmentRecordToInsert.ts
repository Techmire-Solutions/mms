import type { Enrollment } from "@mms/contracts";
import type { enrollments } from "@mms/db/schema";
import { mapAuditToInsert } from "./repositoryMappers.js";
import { requireDbDate } from "../../lib/dbDate.js";

export type EnrollmentInsert = typeof enrollments.$inferInsert;

/** Contract → DB insert values for an enrollment (section/roll resolved by the caller). */
export function recordToInsert(
  tenant: string,
  record: Enrollment,
  options: { preserveSoftDelete?: boolean } = {},
): EnrollmentInsert {
  return {
    id: String(record.id),
    workspaceSubdomain: tenant.trim().toLowerCase(),
    studentId: String(record.studentId || ""),
    studentName: String(record.studentName || ""),
    sessionId: String(record.sessionId || ""),
    sessionName: String(record.sessionName || ""),
    classId: String(record.classId || ""),
    className: String(record.className || ""),
    sectionId: record.sectionId || null,
    rollNo: record.rollNo || null,
    enrolledDate: requireDbDate(record.enrolledDate, "Enrolled date"),
    startOn: record.startOn || null,
    promotedFromEnrollmentId: record.promotedFromEnrollmentId || null,
    baseFee: String(record.baseFee ?? 0),
    discountType: String(record.discountType || "none"),
    discountLabel: String(record.discountLabel || ""),
    discountPct: String(record.discountPct ?? 0),
    discountAmt: String(record.discountAmt ?? 0),
    finalFee: String(record.finalFee ?? 0),
    status: String(record.status || "pending"),
    invoiceId: record.invoiceId ? String(record.invoiceId) : null,
    paymentStatus: String(record.paymentStatus || "none"),
    notes: String(record.notes || ""),
    // Server-owned provenance is stripped at the write choke point: a client `Enrollment`
    // must never set soft-delete or audit-attribution columns. The backup/restore path opts in
    // to preserve them (`preserveSoftDelete`), the only caller that legitimately restores them.
    ...(options.preserveSoftDelete
      ? mapAuditToInsert(record)
      : {
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt: null,
          restoredBy: null,
          deletedWithCascade: false,
        }),
  } satisfies EnrollmentInsert;
}
