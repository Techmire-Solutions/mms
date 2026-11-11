import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

/**
 * Roster reads for examinations: the marks-import roll resolution, the broadsheet names and the
 * teacher-scope section map.
 *
 * Split from `examEligibilityBatchRepository.ts` for the 300-line band; the seat-holding roster
 * rule is identical to the eligibility view's.
 */

/** A mark's exact placement for teacher row-scoping: exam → student → class/section. */
export interface ExamStudentSection {
  examId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
}

/**
 * Class/section of every roster student for the given exams, in one query.
 *
 * Used by the marks-submission guard to apply the exact-section teacher rule: the mark carries the
 * student, and the student's seat-holding enrollment carries the section the teacher must be
 * staffed on. One query for the whole batch.
 */
export async function loadExamStudentSections(
  tenant: string,
  examIds: readonly string[],
): Promise<ExamStudentSection[]> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = [...new Set(examIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (cleanIds.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      examId: string;
      studentId: string;
      classId: string;
      sectionId: string | null;
    }>(sql`
      SELECT ec.exam_id AS "examId",
             e.student_id AS "studentId",
             e.class_id AS "classId",
             e.section_id AS "sectionId"
        FROM exam_classes ec
        JOIN enrollments e
          ON e.workspace_subdomain = ec.workspace_subdomain
         AND e.class_id = ec.class_id
         AND e.deleted_at IS NULL
         AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id IN (${sql.join(
           cleanIds.map((id) => sql`${id}`),
           sql`, `,
         )})
    `);
    return (result.rows ?? []).map((row) => ({
      examId: String(row.examId),
      studentId: String(row.studentId),
      classId: String(row.classId),
      sectionId: row.sectionId ? String(row.sectionId) : null,
    }));
  });
}

/** One roster student: the natural key a marks import matches on, plus display fields. */
export interface ExamRosterEntry {
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  sectionId: string | null;
}

/**
 * The exam's markable roster with roll numbers (deduplicated per student).
 *
 * Used by the marks importer (roll → student) and the broadsheet export (student names), so both
 * resolve against the same seat-holding enrollment set the marks grid uses.
 */
export async function loadExamRoster(tenant: string, examId: string): Promise<ExamRosterEntry[]> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanId = String(examId ?? "").trim();
  if (!cleanId) return [];
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      studentId: string;
      studentName: string;
      rollNumber: string | null;
      classId: string;
      sectionId: string | null;
    }>(sql`
      SELECT e.student_id AS "studentId",
             COALESCE(NULLIF(e.student_name, ''), e.student_id) AS "studentName",
             COALESCE(e.roll_no, '') AS "rollNumber",
             e.class_id AS "classId",
             e.section_id AS "sectionId"
        FROM exam_classes ec
        JOIN enrollments e
          ON e.workspace_subdomain = ec.workspace_subdomain
         AND e.class_id = ec.class_id
         AND e.deleted_at IS NULL
         AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id = ${cleanId}
       ORDER BY COALESCE(e.roll_no, ''), e.student_id
    `);
    const seen = new Set<string>();
    const roster: ExamRosterEntry[] = [];
    for (const row of result.rows ?? []) {
      const studentId = String(row.studentId);
      if (seen.has(studentId)) continue;
      seen.add(studentId);
      roster.push({
        studentId,
        studentName: String(row.studentName),
        rollNumber: String(row.rollNumber ?? ""),
        classId: String(row.classId),
        sectionId: row.sectionId ? String(row.sectionId) : null,
      });
    }
    return roster;
  });
}
