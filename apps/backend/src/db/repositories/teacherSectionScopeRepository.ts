import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

export type ClassDatePair = {
  classId: string;
  /** YYYY-MM-DD business date. */
  onDate: string;
};

/** A mark's exact placement: the section is what a teacher is actually staffed on. */
export type ClassSectionDate = {
  classId: string;
  sectionId: string | null;
  /** YYYY-MM-DD business date. */
  onDate: string;
};

/**
 * Class/date pairs the user's faculty records do NOT teach (no active section staff assignment
 * and no timetable period, primary or assistant). `null` when the user is not linked to faculty.
 */
export async function findUntaughtClassDates(
  tenant: string,
  userId: string,
  pairs: readonly ClassDatePair[],
): Promise<ClassDatePair[] | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const linked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM faculty WHERE workspace_subdomain = ${subdomain} AND user_id = ${userId} AND deleted_at IS NULL
    `);
    const facultyIds = linked.rows.map((row) => row.id);
    if (facultyIds.length === 0) return null;
    if (pairs.length === 0) return [];
    const ids = sql.join(
      facultyIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const values = sql.join(
      pairs.map((p) => sql`(${p.classId}::text, ${p.onDate}::date)`),
      sql`, `,
    );
    const result = await tx.execute<ClassDatePair>(sql`
      SELECT v.class_id AS "classId", to_char(v.on_date, 'YYYY-MM-DD') AS "onDate"
        FROM (VALUES ${values}) AS v(class_id, on_date)
       WHERE NOT EXISTS (
         SELECT 1 FROM section_staff_assignments a
           JOIN session_class_sections s ON s.workspace_subdomain = a.workspace_subdomain AND s.id = a.section_id
          WHERE a.workspace_subdomain = ${subdomain} AND s.class_id = v.class_id AND a.faculty_id IN (${ids})
            AND a.deleted_at IS NULL AND a.start_on <= v.on_date AND (a.end_on IS NULL OR a.end_on >= v.on_date)
       )
       AND NOT EXISTS (
         SELECT 1 FROM session_class_timetable_periods p
           JOIN session_class_timetables t ON t.workspace_subdomain = p.workspace_subdomain AND t.id = p.timetable_id
           LEFT JOIN session_class_timetable_period_staff ps ON ps.workspace_subdomain = p.workspace_subdomain AND ps.period_id = p.id
          WHERE p.workspace_subdomain = ${subdomain} AND t.session_class_id = v.class_id
            AND (p.faculty_id IN (${ids}) OR ps.faculty_id IN (${ids}))
       )
    `);
    return result.rows;
  });
}

/**
 * Class/section/date triples the user's faculty records are **not** staffed on.
 *
 * The class-level check ({@link findUntaughtClassDates}) passes when the teacher has *any* section
 * assignment in the class, so a Section-A teacher could mark Section-B students through the API.
 * This is the exact-section rule: an active `section_staff_assignments` row for that section on
 * that date. Rows whose section is null (unsectioned class) are left to the class-level check.
 *
 * Returns `null` when the user is not linked to a faculty record (office/admin staff are unscoped).
 */
export async function findUnstaffedSectionDates(
  tenant: string,
  userId: string,
  rows: readonly ClassSectionDate[],
): Promise<ClassSectionDate[] | null> {
  const subdomain = tenant.trim().toLowerCase();
  const sectioned = rows.filter((row) => row.classId && row.sectionId);
  return withTenantRead(subdomain, async (tx) => {
    const linked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM faculty WHERE workspace_subdomain = ${subdomain} AND user_id = ${userId} AND deleted_at IS NULL
    `);
    const facultyIds = linked.rows.map((row) => row.id);
    if (facultyIds.length === 0) return null;
    if (sectioned.length === 0) return [];
    const ids = sql.join(
      facultyIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const values = sql.join(
      sectioned.map(
        (row) => sql`(${row.classId}::text, ${row.sectionId}::text, ${row.onDate}::date)`,
      ),
      sql`, `,
    );
    const result = await tx.execute<ClassSectionDate>(sql`
      SELECT v.class_id AS "classId", v.section_id AS "sectionId",
             to_char(v.on_date, 'YYYY-MM-DD') AS "onDate"
        FROM (VALUES ${values}) AS v(class_id, section_id, on_date)
       WHERE NOT EXISTS (
         SELECT 1 FROM section_staff_assignments a
           JOIN session_class_sections s
             ON s.workspace_subdomain = a.workspace_subdomain AND s.id = a.section_id
          WHERE a.workspace_subdomain = ${subdomain}
            AND s.class_id = v.class_id
            AND s.id = v.section_id
            AND a.faculty_id IN (${ids})
            AND a.deleted_at IS NULL
            AND a.start_on <= v.on_date
            AND (a.end_on IS NULL OR a.end_on >= v.on_date)
       )
    `);
    return result.rows;
  });
}

/**
 * Student ids the user teaches between two dates, or `null` when the user is not section-scoped.
 *
 * Used to keep excuse data (reason + medical certificate reference) inside the classes a teacher is
 * responsible for. `null` means "office/admin staff with no faculty record" — they stay unscoped.
 */
export async function listTaughtStudentIds(
  tenant: string,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<Set<string> | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const linked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM faculty WHERE workspace_subdomain = ${subdomain} AND user_id = ${userId} AND deleted_at IS NULL
    `);
    const facultyIds = linked.rows.map((row) => row.id);
    if (facultyIds.length === 0) return null;
    const ids = sql.join(
      facultyIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const result = await tx.execute<{ studentId: string }>(sql`
      WITH taught_sections AS (
        SELECT a.section_id AS section_id
          FROM section_staff_assignments a
         WHERE a.workspace_subdomain = ${subdomain}
           AND a.faculty_id IN (${ids})
           AND a.deleted_at IS NULL
           AND a.start_on <= ${toDate}::date
           AND (a.end_on IS NULL OR a.end_on >= ${fromDate}::date)
      ), taught_classes AS (
        SELECT t.session_class_id AS class_id
          FROM session_class_timetable_periods p
          JOIN session_class_timetables t
            ON t.workspace_subdomain = p.workspace_subdomain AND t.id = p.timetable_id
          LEFT JOIN session_class_timetable_period_staff ps
            ON ps.workspace_subdomain = p.workspace_subdomain AND ps.period_id = p.id
         WHERE p.workspace_subdomain = ${subdomain}
           AND (p.faculty_id IN (${ids}) OR ps.faculty_id IN (${ids}))
      )
      SELECT DISTINCT e.student_id AS "studentId"
        FROM enrollments e
       WHERE e.workspace_subdomain = ${subdomain}
         AND e.deleted_at IS NULL
         AND (
           e.section_id IN (SELECT section_id FROM taught_sections)
           OR e.class_id IN (SELECT class_id FROM taught_classes)
         )
         AND (e.start_on IS NULL OR e.start_on <= ${toDate}::date)
         AND (e.end_on IS NULL OR e.end_on >= ${fromDate}::date)
    `);
    return new Set((result.rows ?? []).map((row) => String(row.studentId)));
  });
}
