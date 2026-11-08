import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type AttendanceRecord } from "@mms/shared";
import { attendance } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import {
  attendanceRowToRecord as rowToRecord,
  attendanceRecordToInsert as recordToInsert,
} from "./attendanceRepositoryMappers.js";
import { attendanceStaleWriteError } from "./attendanceUpsert.js";

/**
 * "Address a known row" — projections, lookups, and the by-id update.
 *
 * Split from `attendanceRepository.ts` for the 300-line band (mms-structure-naming §3): the
 * natural-key upserts answer "record this roster", whereas these answer "read/update this row".
 */

/** Explicit projection shared with the upsert module (one definition, no circular import). */
export const ATTENDANCE_RECORD_COLUMNS = {
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
  markedBy: attendance.markedBy,
  sectionId: attendance.sectionId,
  version: attendance.version,
  deletedAt: attendance.deletedAt,
  deletedBy: attendance.deletedBy,
  deletionReason: attendance.deletionReason,
  restoredAt: attendance.restoredAt,
  restoredBy: attendance.restoredBy,
  deletedWithCascade: attendance.deletedWithCascade,
  createdAt: attendance.createdAt,
  updatedAt: attendance.updatedAt,
};

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
      .select(ATTENDANCE_RECORD_COLUMNS)
      .from(attendance)
      .where(and(...conditions))
      .orderBy(attendance.id)
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
      .select(ATTENDANCE_RECORD_COLUMNS)
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
      .select(ATTENDANCE_RECORD_COLUMNS)
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, subdomain), inArray(attendance.id, cleanIds)));
    return rows.map(rowToRecord);
  });
}

/**
 * Live rows of the given students on the given days.
 *
 * Used by the roster-save policy/audit pass to diff "what was" against "what will be" in one query
 * instead of one lookup per row. Served by `attendance_workspace_student_idx`.
 */
export async function findAttendanceRecordsForStudentsOnDates(
  tenant: string,
  studentIds: string[],
  days: string[],
): Promise<AttendanceRecord[]> {
  const cleanStudentIds = dedupeTrimmedIds(studentIds);
  const cleanDays = [...new Set(days.map((day) => day.trim().slice(0, 10)).filter(Boolean))];
  if (cleanStudentIds.length === 0 || cleanDays.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(ATTENDANCE_RECORD_COLUMNS)
      .from(attendance)
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          inArray(attendance.studentId, cleanStudentIds),
          inArray(attendance.date, cleanDays),
          isNull(attendance.deletedAt),
        ),
      );
    return rows.map(rowToRecord);
  });
}

/**
 * Updates the row addressed by `id` — the correct primitive when the business key itself changes
 * (moving a mark to another day/class).
 *
 * The natural-key upsert cannot express that: a changed `(class, student, day)` takes its INSERT
 * branch with the same surrogate id and hits the primary key. An update keyed on `id` moves the row
 * instead, and the partial unique index still refuses to land it on an occupied slot (`23505`).
 *
 * Returns `null` when the row does not exist or is archived.
 */
export async function saveAttendanceRecordById(
  tenant: string,
  record: AttendanceRecord,
): Promise<AttendanceRecord | null> {
  const subdomain = tenant.trim().toLowerCase();
  const values = recordToInsert(subdomain, record);
  const expectedVersion = typeof record.version === "number" ? record.version : undefined;
  return withTenant(subdomain, async (tx) => {
    try {
      const rows = await tx
        .update(attendance)
        .set({
          classId: values.classId,
          studentId: values.studentId,
          studentName: values.studentName,
          rollNo: values.rollNo,
          date: values.date,
          status: values.status,
          timeIn: values.timeIn,
          timeOut: values.timeOut,
          notes: values.notes,
          markedBy: values.markedBy,
          sectionId: values.sectionId,
          updatedAt: new Date(),
          version: sql`${attendance.version} + 1`,
        })
        .where(
          and(
            eq(attendance.workspaceSubdomain, subdomain),
            eq(attendance.id, String(record.id)),
            isNull(attendance.deletedAt),
            ...(expectedVersion !== undefined ? [eq(attendance.version, expectedVersion)] : []),
          ),
        )
        .returning(ATTENDANCE_RECORD_COLUMNS);

      const row = rows[0];
      if (row) return rowToRecord(row);

      // No row updated: either it is gone/archived, or the OCC token moved. Distinguish so a
      // genuine 404 is not reported as a lost race.
      const [current] = await tx
        .select({ version: attendance.version, deletedAt: attendance.deletedAt })
        .from(attendance)
        .where(
          and(eq(attendance.workspaceSubdomain, subdomain), eq(attendance.id, String(record.id))),
        )
        .limit(1);
      if (!current || current.deletedAt) return null;
      throw attendanceStaleWriteError(record);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `Another attendance mark already exists for student ${record.studentId} on ${record.date}`,
          "attendance_duplicate",
        );
      }
      throw error;
    }
  });
}
