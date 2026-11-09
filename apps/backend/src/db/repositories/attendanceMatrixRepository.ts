import { and, asc, eq, gt, gte, inArray, isNull, lte, notInArray, sql } from "drizzle-orm";
import { attendance, enrollments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Register/matrix reads.
 *
 * Two narrow queries instead of one wide join: the roster page (students of a class/section, keyset
 * by `student_id`) and the marks for exactly those students in the requested range. The export
 * service asks for the roster in chunks, so memory is `chunk × days`, never `students × days`.
 */

export interface MatrixStudent {
  studentId: string;
  studentName: string;
  rollNo: string;
}

const INACTIVE_ENROLLMENT_STATUSES = [
  "cancelled",
  "withdrawn",
  "promoted",
  "retained",
  "graduated",
  "left",
] as const;

/** One page of the roster, ordered by `student_id` so the keyset cursor is stable. */
export async function listMatrixStudentsPage(
  tenant: string,
  input: { classId: string; sectionId?: string; afterStudentId?: string; limit: number },
): Promise<{ students: MatrixStudent[]; hasMore: boolean; nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit, 1), 500);
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(enrollments.workspaceSubdomain, subdomain),
      eq(enrollments.classId, input.classId),
      isNull(enrollments.deletedAt),
      notInArray(enrollments.status, [...INACTIVE_ENROLLMENT_STATUSES]),
    ];
    if (input.sectionId) conditions.push(eq(enrollments.sectionId, input.sectionId));
    if (input.afterStudentId) conditions.push(gt(enrollments.studentId, input.afterStudentId));

    const rows = await tx
      .select({
        studentId: enrollments.studentId,
        studentName: enrollments.studentName,
        rollNo: enrollments.rollNo,
      })
      .from(enrollments)
      .where(and(...conditions))
      .orderBy(asc(enrollments.studentId))
      .limit(limit + 1);

    const page = rows.slice(0, limit).map((row) => ({
      studentId: String(row.studentId),
      studentName: String(row.studentName ?? ""),
      rollNo: String(row.rollNo ?? ""),
    }));
    return {
      students: page,
      hasMore: rows.length > limit,
      ...(rows.length > limit ? { nextCursor: page[page.length - 1]?.studentId } : {}),
    };
  });
}

export interface MatrixMark {
  studentId: string;
  date: string;
  status: string;
}

/** Live marks for exactly these students, inside the range (index: workspace + class + date). */
export async function listMatrixMarks(
  tenant: string,
  input: { classId: string; studentIds: readonly string[]; dateFrom: string; dateTo: string },
): Promise<MatrixMark[]> {
  const subdomain = tenant.trim().toLowerCase();
  if (input.studentIds.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        studentId: attendance.studentId,
        date: attendance.date,
        status: attendance.status,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          eq(attendance.classId, input.classId),
          inArray(attendance.studentId, [...input.studentIds]),
          isNull(attendance.deletedAt),
          gte(attendance.date, input.dateFrom),
          lte(attendance.date, input.dateTo),
        ),
      );
    return rows.map((row) => ({
      studentId: String(row.studentId),
      date: String(row.date).slice(0, 10),
      status: String(row.status),
    }));
  });
}

/** Roster size for the XLSX cell budget (same filters as the page query). */
export async function countMatrixStudents(
  tenant: string,
  input: { classId: string; sectionId?: string },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(enrollments.workspaceSubdomain, subdomain),
      eq(enrollments.classId, input.classId),
      isNull(enrollments.deletedAt),
      notInArray(enrollments.status, [...INACTIVE_ENROLLMENT_STATUSES]),
    ];
    if (input.sectionId) conditions.push(eq(enrollments.sectionId, input.sectionId));
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(...conditions));
    return Number(row?.count ?? 0);
  });
}
