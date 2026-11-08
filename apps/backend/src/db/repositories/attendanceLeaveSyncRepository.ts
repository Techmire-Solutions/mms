import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { attendance } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/**
 * Retroactive mark synchronisation and the per-student lock that serialises it against marking.
 * Split from the workflow repository for the 300-line band.
 */

export interface ExcusedAttendanceRow {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  previousStatus: string;
  previousNotes: string;
}

/**
 * Retroactively excuses every unexcused absence inside an approved leave range.
 *
 * Only `absent` rows are touched — a `present`/`late` mark is evidence the student *was* there, and
 * rewriting it would destroy the record the leave is supposed to explain. The note is prefixed so the
 * conversion is visible in the row itself, not only in the audit trail.
 */
export async function excuseAbsencesInRange(
  tenant: string,
  input: {
    studentId: string;
    fromDate: string;
    toDate: string;
    note: string;
    at?: Date;
  },
): Promise<ExcusedAttendanceRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const at = input.at ?? new Date();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .update(attendance)
      .set({
        status: "excused",
        notes: sql`CASE WHEN ${attendance.notes} = '' THEN ${input.note} ELSE ${attendance.notes} || ' · ' || ${input.note} END`,
        updatedAt: at,
        version: sql`${attendance.version} + 1`,
      })
      .where(
        and(
          eq(attendance.workspaceSubdomain, subdomain),
          eq(attendance.studentId, input.studentId),
          gte(attendance.date, input.fromDate),
          lte(attendance.date, input.toDate),
          eq(attendance.status, "absent"),
          isNull(attendance.deletedAt),
        ),
      )
      .returning({
        id: attendance.id,
        studentId: attendance.studentId,
        classId: attendance.classId,
        date: attendance.date,
        status: attendance.status,
        notes: attendance.notes,
      });
    return rows.map((row) => ({
      id: String(row.id),
      studentId: String(row.studentId),
      classId: String(row.classId),
      date: String(row.date),
      previousStatus: "absent",
      previousNotes: "",
    }));
  });
}

/**
 * Serialises leave decisions against attendance writes for the given students.
 *
 * Both paths take the same transaction-scoped advisory lock, so "is there approved leave covering
 * this day?" can never be answered differently by the two writers (F5). Ids are sorted so two
 * batches cannot deadlock on the locks themselves.
 */
export async function lockAttendanceStudents(
  tenant: string,
  studentIds: readonly string[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (ids.length === 0) return;
  // One round trip: the ordered subquery fixes the acquisition order, so two batches can never take
  // the same locks in opposite order and deadlock.
  await withTenant(subdomain, async (tx) => {
    const arrayElements = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtext('attendance:student:' || ${subdomain} || ':' || ordered.student_id)
      )
        FROM (SELECT unnest(ARRAY[${arrayElements}]::text[]) AS student_id ORDER BY student_id) ordered
    `);
  });
}
