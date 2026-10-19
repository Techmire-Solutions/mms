import { and, asc, eq, inArray } from "drizzle-orm";
import type { Enrollment, EnrollmentTimelineItem } from "@mms/shared";
import { enrollments, enrollmentTimelineEvents } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

/** Full enrollment projection shared by every hydrate path. */
export const ENROLLMENT_COLUMNS = {
  id: enrollments.id,
  workspaceSubdomain: enrollments.workspaceSubdomain,
  studentId: enrollments.studentId,
  studentName: enrollments.studentName,
  sessionId: enrollments.sessionId,
  sessionName: enrollments.sessionName,
  classId: enrollments.classId,
  className: enrollments.className,
  sectionId: enrollments.sectionId,
  rollNo: enrollments.rollNo,
  enrolledDate: enrollments.enrolledDate,
  startOn: enrollments.startOn,
  endOn: enrollments.endOn,
  endReason: enrollments.endReason,
  promotedFromEnrollmentId: enrollments.promotedFromEnrollmentId,
  completionStatus: enrollments.completionStatus,
  completedAt: enrollments.completedAt,
  certificateIssuedAt: enrollments.certificateIssuedAt,
  baseFee: enrollments.baseFee,
  discountType: enrollments.discountType,
  discountLabel: enrollments.discountLabel,
  discountPct: enrollments.discountPct,
  discountAmt: enrollments.discountAmt,
  finalFee: enrollments.finalFee,
  status: enrollments.status,
  invoiceId: enrollments.invoiceId,
  paymentStatus: enrollments.paymentStatus,
  notes: enrollments.notes,
  deletedAt: enrollments.deletedAt,
  deletedBy: enrollments.deletedBy,
  deletionReason: enrollments.deletionReason,
  deletedWithCascade: enrollments.deletedWithCascade,
  restoredAt: enrollments.restoredAt,
  restoredBy: enrollments.restoredBy,
  createdAt: enrollments.createdAt,
  updatedAt: enrollments.updatedAt,
};

/** Columns read for the enrollment record; list pages may project a subset. */
export type EnrollmentHydrateRow = Pick<
  typeof enrollments.$inferSelect,
  Exclude<
    keyof typeof ENROLLMENT_COLUMNS,
    | "notes"
    | "sectionId"
    | "rollNo"
    | "startOn"
    | "endOn"
    | "endReason"
    | "restoredAt"
    | "restoredBy"
  >
> &
  Partial<
    Pick<
      typeof enrollments.$inferSelect,
      | "sectionId"
      | "rollNo"
      | "startOn"
      | "endOn"
      | "endReason"
      | "promotedFromEnrollmentId"
      | "completionStatus"
      | "completedAt"
      | "certificateIssuedAt"
      | "restoredAt"
      | "restoredBy"
    >
  > & { notes: string | null };

const TIMELINE_COLUMNS = {
  id: enrollmentTimelineEvents.id,
  enrollmentId: enrollmentTimelineEvents.enrollmentId,
  ts: enrollmentTimelineEvents.ts,
  event: enrollmentTimelineEvents.event,
  by: enrollmentTimelineEvents.by,
  eventType: enrollmentTimelineEvents.eventType,
  effectiveOn: enrollmentTimelineEvents.effectiveOn,
  reason: enrollmentTimelineEvents.reason,
  fromClassId: enrollmentTimelineEvents.fromClassId,
  toClassId: enrollmentTimelineEvents.toClassId,
  fromSectionId: enrollmentTimelineEvents.fromSectionId,
  toSectionId: enrollmentTimelineEvents.toSectionId,
};

/** Timeline items per enrollment id, oldest first. */
export async function loadTimelineMapTx(
  tx: TenantTransaction,
  subdomain: string,
  enrollmentIds: readonly string[],
): Promise<Map<string, EnrollmentTimelineItem[]>> {
  const map = new Map<string, EnrollmentTimelineItem[]>();
  if (enrollmentIds.length === 0) return map;
  const rows = await tx
    .select(TIMELINE_COLUMNS)
    .from(enrollmentTimelineEvents)
    .where(
      and(
        eq(enrollmentTimelineEvents.workspaceSubdomain, subdomain),
        inArray(enrollmentTimelineEvents.enrollmentId, [...enrollmentIds]),
      ),
    )
    .orderBy(asc(enrollmentTimelineEvents.id));
  for (const { enrollmentId, ...item } of rows) {
    const list = map.get(enrollmentId) ?? [];
    list.push(item);
    map.set(enrollmentId, list);
  }
  return map;
}

export function enrollmentRowToRecord(
  row: EnrollmentHydrateRow,
  timeline: EnrollmentTimelineItem[] = [],
): Enrollment {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    sessionId: row.sessionId,
    sessionName: row.sessionName,
    classId: row.classId,
    className: row.className,
    sectionId: row.sectionId ?? undefined,
    rollNo: row.rollNo ?? undefined,
    enrolledDate: row.enrolledDate,
    startOn: row.startOn ?? null,
    endOn: row.endOn ?? null,
    endReason: row.endReason ?? null,
    promotedFromEnrollmentId: row.promotedFromEnrollmentId ?? null,
    completionStatus:
      row.completionStatus === "completed" || row.completionStatus === "not_completed"
        ? row.completionStatus
        : null,
    completedAt: row.completedAt?.toISOString() ?? null,
    certificateIssuedAt: row.certificateIssuedAt?.toISOString() ?? null,
    baseFee: Number(row.baseFee ?? 0),
    discountType: row.discountType,
    discountLabel: row.discountLabel,
    discountPct: Number(row.discountPct ?? 0),
    discountAmt: Number(row.discountAmt ?? 0),
    finalFee: Number(row.finalFee ?? 0),
    status: row.status as Enrollment["status"],
    invoiceId: row.invoiceId ?? null,
    paymentStatus: row.paymentStatus as Enrollment["paymentStatus"],
    notes: row.notes ?? "",
    timeline,
    ...mapAuditTimestamps(row),
  };
}
