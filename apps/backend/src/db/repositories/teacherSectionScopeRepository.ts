import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

export type ClassDatePair = {
  classId: string;
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
