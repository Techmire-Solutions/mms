import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { attendanceLeaves, contacts, students } from "../schema.js";
import type { AttendanceLeaveStatus, AttendanceLeaveType } from "@mms/shared";
import { withTenant, withTenantRead } from "../tenant-context.js";

/**
 * Excuse / leave workflow storage: submit, decide (guarded), cancel, and the retroactive mark
 * synchronisation an approval performs.
 */

export interface AttendanceLeaveWorkflowRow {
  id: string;
  studentId: string;
  studentName: string;
  fromDate: string | null;
  toDate: string | null;
  reason: string;
  status: AttendanceLeaveStatus;
  leaveType: AttendanceLeaveType;
  submittedBy: string | null;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  documentRef: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LEAVE_BASE_COLUMNS = {
  id: attendanceLeaves.id,
  studentId: attendanceLeaves.studentId,
  fromDate: attendanceLeaves.fromDate,
  toDate: attendanceLeaves.toDate,
  reason: attendanceLeaves.reason,
  status: attendanceLeaves.status,
  leaveType: attendanceLeaves.leaveType,
  submittedBy: attendanceLeaves.submittedBy,
  submittedAt: attendanceLeaves.submittedAt,
  reviewedBy: attendanceLeaves.reviewedBy,
  reviewedAt: attendanceLeaves.reviewedAt,
  reviewNote: attendanceLeaves.reviewNote,
  cancelledBy: attendanceLeaves.cancelledBy,
  cancelledAt: attendanceLeaves.cancelledAt,
  documentRef: attendanceLeaves.documentRef,
  approvedBy: attendanceLeaves.approvedBy,
  approvedAt: attendanceLeaves.approvedAt,
  notes: attendanceLeaves.notes,
  createdAt: attendanceLeaves.createdAt,
  updatedAt: attendanceLeaves.updatedAt,
};

const LEAVE_COLUMNS = {
  ...LEAVE_BASE_COLUMNS,
  // The student's display name lives on the linked contact; fall back to the GR number.
  studentName: sql<string>`COALESCE(NULLIF(${contacts.name}, ''), ${students.grNumber}, '')`,
};

function toRow(row: Record<string, unknown>): AttendanceLeaveWorkflowRow {
  return {
    id: String(row.id),
    studentId: String(row.studentId ?? ""),
    studentName: String(row.studentName ?? ""),
    fromDate: row.fromDate ? String(row.fromDate) : null,
    toDate: row.toDate ? String(row.toDate) : null,
    reason: String(row.reason ?? ""),
    status: String(row.status ?? "pending") as AttendanceLeaveStatus,
    leaveType: String(row.leaveType ?? "other") as AttendanceLeaveType,
    submittedBy: row.submittedBy ? String(row.submittedBy) : null,
    submittedAt: row.submittedAt instanceof Date ? row.submittedAt : null,
    reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
    reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt : null,
    reviewNote: row.reviewNote ? String(row.reviewNote) : null,
    cancelledBy: row.cancelledBy ? String(row.cancelledBy) : null,
    cancelledAt: row.cancelledAt instanceof Date ? row.cancelledAt : null,
    documentRef: row.documentRef ? String(row.documentRef) : null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt instanceof Date ? row.approvedAt : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(0),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(0),
  };
}

type LeaveTx = Parameters<Parameters<typeof withTenantRead>[1]>[0];

function baseQuery(tx: LeaveTx) {
  return tx
    .select(LEAVE_COLUMNS)
    .from(attendanceLeaves)
    .leftJoin(
      students,
      and(
        eq(students.workspaceSubdomain, attendanceLeaves.workspaceSubdomain),
        eq(students.id, attendanceLeaves.studentId),
      ),
    )
    .leftJoin(
      contacts,
      and(
        eq(contacts.workspaceSubdomain, students.workspaceSubdomain),
        eq(contacts.id, students.contactId),
      ),
    )
    .$dynamic();
}

export async function listAttendanceLeaves(
  tenant: string,
  query: {
    status?: AttendanceLeaveStatus;
    studentId?: string;
    fromDate?: string;
    toDate?: string;
  } = {},
): Promise<AttendanceLeaveWorkflowRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(attendanceLeaves.workspaceSubdomain, subdomain)];
    if (query.status) conditions.push(eq(attendanceLeaves.status, query.status));
    if (query.studentId) conditions.push(eq(attendanceLeaves.studentId, query.studentId));
    if (query.toDate) conditions.push(lte(attendanceLeaves.fromDate, query.toDate));
    if (query.fromDate) conditions.push(gte(attendanceLeaves.toDate, query.fromDate));
    const rows = await baseQuery(tx)
      .where(and(...conditions))
      .orderBy(asc(attendanceLeaves.fromDate), asc(attendanceLeaves.id))
      .limit(500);
    return rows.map((row) => toRow(row as Record<string, unknown>));
  });
}

export async function findAttendanceLeaveById(
  tenant: string,
  id: string,
): Promise<AttendanceLeaveWorkflowRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await baseQuery(tx)
      .where(
        and(eq(attendanceLeaves.workspaceSubdomain, subdomain), eq(attendanceLeaves.id, id.trim())),
      )
      .limit(1);
    return row ? toRow(row as Record<string, unknown>) : null;
  });
}

export async function insertPendingLeave(
  tenant: string,
  input: {
    studentId: string;
    fromDate: string;
    toDate: string;
    reason: string;
    leaveType: AttendanceLeaveType;
    documentRef?: string | null;
    notes?: string | null;
    submittedBy: string;
  },
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const id = randomUUID();
  const now = new Date();
  await withTenant(subdomain, (tx) =>
    tx.insert(attendanceLeaves).values({
      id,
      workspaceSubdomain: subdomain,
      studentId: input.studentId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
      status: "pending",
      leaveType: input.leaveType,
      submittedBy: input.submittedBy,
      submittedAt: now,
      documentRef: input.documentRef || null,
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return id;
}

/**
 * Records a reviewer decision, guarded to `pending` rows.
 *
 * The `status = 'pending'` predicate is the transition guard: two reviewers clicking at once produce
 * exactly one decision, and the loser gets `null` (mapped to 409) instead of overwriting the first.
 */
export async function decideAttendanceLeave(
  tenant: string,
  input: {
    id: string;
    status: "approved" | "rejected";
    reviewedBy: string;
    note?: string | null;
    at?: Date;
  },
): Promise<AttendanceLeaveWorkflowRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  const at = input.at ?? new Date();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .update(attendanceLeaves)
      .set({
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: at,
        reviewNote: input.note?.trim() ? input.note.trim() : null,
        // Keep the legacy approval pair coherent for readers that still use it.
        ...(input.status === "approved" ? { approvedBy: input.reviewedBy, approvedAt: at } : {}),
        updatedAt: at,
      })
      .where(
        and(
          eq(attendanceLeaves.workspaceSubdomain, subdomain),
          eq(attendanceLeaves.id, input.id),
          eq(attendanceLeaves.status, "pending"),
        ),
      )
      .returning(LEAVE_BASE_COLUMNS);
    return row ? toRow(row as Record<string, unknown>) : null;
  });
}

/** Cancels a pending request or revokes an approved leave; terminal states are rejected. */
export async function cancelAttendanceLeave(
  tenant: string,
  input: { id: string; cancelledBy: string; reason?: string | null; at?: Date },
): Promise<AttendanceLeaveWorkflowRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  const at = input.at ?? new Date();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .update(attendanceLeaves)
      .set({
        status: "cancelled",
        cancelledBy: input.cancelledBy,
        cancelledAt: at,
        ...(input.reason?.trim() ? { reviewNote: input.reason.trim() } : {}),
        updatedAt: at,
      })
      .where(
        and(
          eq(attendanceLeaves.workspaceSubdomain, subdomain),
          eq(attendanceLeaves.id, input.id),
          inArray(attendanceLeaves.status, ["pending", "approved"]),
        ),
      )
      .returning(LEAVE_BASE_COLUMNS);
    return row ? toRow(row as Record<string, unknown>) : null;
  });
}
