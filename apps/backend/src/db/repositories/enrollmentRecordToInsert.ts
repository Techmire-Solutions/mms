import type { Enrollment } from "@mms/shared";
import type { enrollments } from "../schema.js";
import { mapAuditToInsert } from "./repositoryMappers.js";

export type EnrollmentInsert = typeof enrollments.$inferInsert;

/** Contract → DB insert values for an enrollment (section/roll resolved by the caller). */
export function recordToInsert(tenant: string, record: Enrollment): EnrollmentInsert {
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
    enrolledDate: String(record.enrolledDate || ""),
    startOn: record.startOn || null,
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
    ...mapAuditToInsert(record),
  } satisfies EnrollmentInsert;
}
