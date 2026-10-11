import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { attendance, attendanceLeaves } from "../schema.js";
import { dedupeTrimmedIds, type AttendanceRecord } from "@mms/shared";
import { withTenant, withTenantRead } from "../tenant-context.js";
import {
  attendanceRowToRecord as rowToRecord,
  attendanceRecordToInsert as recordToInsert,
} from "./attendanceRepositoryMappers.js";

export async function listAttendanceRecordsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number; includeDeleted?: boolean },
): Promise<AttendanceRecord[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(attendance.workspaceSubdomain, subdomain)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(attendance.deletedAt));
    }
    const rows = await tx
      .select({
        id: attendance.id,
        workspaceSubdomain: attendance.workspaceSubdomain,
        classId: attendance.classId,
        studentId: attendance.studentId,
        studentName: attendance.studentName,
        rollNo: attendance.rollNo,
        date: attendance.date,
        status: attendance.status,
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
        notes: attendance.notes,
        deletedAt: attendance.deletedAt,
        deletedBy: attendance.deletedBy,
        deletionReason: attendance.deletionReason,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    return rows.map(rowToRecord);
  });
}

export async function findAttendanceRecordById(
  tenant: string,
  id: string,
): Promise<AttendanceRecord | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: attendance.id,
        workspaceSubdomain: attendance.workspaceSubdomain,
        classId: attendance.classId,
        studentId: attendance.studentId,
        studentName: attendance.studentName,
        rollNo: attendance.rollNo,
        date: attendance.date,
        status: attendance.status,
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
        notes: attendance.notes,
        deletedAt: attendance.deletedAt,
        deletedBy: attendance.deletedBy,
        deletionReason: attendance.deletionReason,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, subdomain), eq(attendance.id, trimmedId)))
      .limit(1);
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  });
}

export async function findAttendanceRecordsByIds(
  tenant: string,
  ids: string[],
): Promise<AttendanceRecord[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: attendance.id,
        workspaceSubdomain: attendance.workspaceSubdomain,
        classId: attendance.classId,
        studentId: attendance.studentId,
        studentName: attendance.studentName,
        rollNo: attendance.rollNo,
        date: attendance.date,
        status: attendance.status,
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
        notes: attendance.notes,
        deletedAt: attendance.deletedAt,
        deletedBy: attendance.deletedBy,
        deletionReason: attendance.deletionReason,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, subdomain), inArray(attendance.id, cleanIds)));
    return rows.map(rowToRecord);
  });
}

export async function saveAttendanceRecord(
  tenant: string,
  record: AttendanceRecord,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const values = recordToInsert(subdomain, record);
    await tx
      .insert(attendance)
      .values(values)
      .onConflictDoUpdate({
        target: [attendance.workspaceSubdomain, attendance.id],
        set: {
          classId: values.classId,
          studentId: values.studentId,
          studentName: values.studentName,
          rollNo: values.rollNo,
          date: values.date,
          status: values.status,
          timeIn: values.timeIn,
          timeOut: values.timeOut,
          notes: values.notes,
          deletedAt: values.deletedAt,
          deletedBy: values.deletedBy,
          deletionReason: values.deletionReason,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveAttendanceRecords(
  tenant: string,
  records: AttendanceRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    const id = typeof r.id === "string" && r.id.trim() !== "" ? r.id.trim() : `att-${randomUUID()}`;
    recordMap.set(id, { ...r, id });
  }
  const uniqueRecords = Array.from(recordMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(attendance)
      .values(uniqueRecords.map((record) => recordToInsert(subdomain, record)))
      .onConflictDoUpdate({
        target: [attendance.workspaceSubdomain, attendance.id],
        set: {
          classId: sql`excluded.class_id`,
          studentId: sql`excluded.student_id`,
          studentName: sql`excluded.student_name`,
          rollNo: sql`excluded.roll_no`,
          date: sql`excluded.date`,
          status: sql`excluded.status`,
          timeIn: sql`excluded.time_in`,
          timeOut: sql`excluded.time_out`,
          notes: sql`excluded.notes`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function deleteAttendanceRecord(tenant: string, id: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const result = await tx
      .delete(attendance)
      .where(and(eq(attendance.workspaceSubdomain, subdomain), eq(attendance.id, id)));
    return Boolean(result.rowCount && result.rowCount > 0);
  });
}

export async function replaceAttendanceRecordsForWorkspace(
  tenant: string,
  records: AttendanceRecord[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    const id = typeof r.id === "string" && r.id.trim() !== "" ? r.id.trim() : `att-${randomUUID()}`;
    recordMap.set(id, { ...r, id });
  }
  const uniqueRecords = Array.from(recordMap.values());

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
    const updated = await tx
      .update(attendance)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
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

export async function bulkRestoreAttendanceRecords(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(attendance)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          inArray(attendance.id, uniqueIds),
          isNotNull(attendance.deletedAt),
        ),
      )
      .returning({ id: attendance.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
