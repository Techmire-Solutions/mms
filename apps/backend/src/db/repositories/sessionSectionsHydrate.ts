import { sql } from "drizzle-orm";
import type { Session, SessionClassSection } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";

type SectionRow = {
  id: string;
  classId: string;
  name: string;
  capacity: number;
  room: string | null;
  status: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
  enrolled: number;
};

/**
 * Attaches sections (and timetable-period assistants) to every class of the given sessions (one query): current class teacher
 * (active assignment on the workspace business day) and active, non-cancelled enrollment count.
 */
export async function attachClassSectionsTx(
  tx: TenantTransaction,
  subdomain: string,
  sessions: Session[],
): Promise<Session[]> {
  const classIds = sessions.flatMap((session) =>
    (session.classes ?? []).map((cls) => String(cls.id)),
  );
  if (classIds.length === 0) return sessions;

  const result = await tx.execute<SectionRow>(sql`
    WITH business_day AS (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date AS today
      FROM workspaces WHERE subdomain = ${subdomain}
    )
    SELECT s.id, s.class_id AS "classId", s.name, s.capacity, s.room, s.status,
           ct.faculty_id AS "classTeacherId", ct.name AS "classTeacherName",
           (SELECT count(*)::int FROM enrollments e
             WHERE e.workspace_subdomain = s.workspace_subdomain AND e.section_id = s.id
               AND e.deleted_at IS NULL AND e.status <> 'cancelled') AS enrolled
      FROM session_class_sections s
      LEFT JOIN LATERAL (
        SELECT a.faculty_id, concat_ws(' ', c.first_name, c.last_name) AS name
          FROM section_staff_assignments a
          CROSS JOIN business_day b
          LEFT JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
          LEFT JOIN faculty_employments fe ON fe.workspace_subdomain = f.workspace_subdomain AND fe.id = f.employment_id
          LEFT JOIN contacts c ON c.workspace_subdomain = fe.workspace_subdomain AND c.id = fe.contact_id
         WHERE a.workspace_subdomain = s.workspace_subdomain AND a.section_id = s.id
           AND a.role = 'class_teacher' AND a.deleted_at IS NULL
           AND a.start_on <= b.today AND (a.end_on IS NULL OR a.end_on >= b.today)
         ORDER BY a.start_on DESC
         LIMIT 1
      ) ct ON true
     WHERE s.workspace_subdomain = ${subdomain}
       AND s.class_id IN (${sql.join(
         classIds.map((id) => sql`${id}`),
         sql`, `,
       )})
     ORDER BY s.class_id, s.sort_order, s.name
  `);

  const byClass = new Map<string, SessionClassSection[]>();
  for (const row of result.rows) {
    const list = byClass.get(row.classId) ?? [];
    list.push({
      id: row.id,
      classId: row.classId,
      name: row.name,
      capacity: Number(row.capacity ?? 0),
      room: row.room ?? "",
      status: row.status === "closed" ? "closed" : "active",
      classTeacherId: row.classTeacherId ?? undefined,
      classTeacherName: row.classTeacherName?.trim() || undefined,
      enrolled: Number(row.enrolled ?? 0),
    });
    byClass.set(row.classId, list);
  }

  const periodIds = sessions.flatMap((session) =>
    (session.classes ?? []).flatMap((cls) =>
      (cls.timetables ?? []).flatMap((timetable) =>
        (timetable.periods ?? []).map((period) => period.id),
      ),
    ),
  );
  const assistantsByPeriod = new Map<string, string[]>();
  if (periodIds.length > 0) {
    const staff = await tx.execute<{ periodId: string; facultyId: string }>(sql`
      SELECT period_id AS "periodId", faculty_id AS "facultyId" FROM session_class_timetable_period_staff
       WHERE workspace_subdomain = ${subdomain} AND period_id IN (${sql.join(
         periodIds.map((id) => sql`${id}`),
         sql`, `,
       )})
    `);
    for (const row of staff.rows)
      assistantsByPeriod.set(row.periodId, [
        ...(assistantsByPeriod.get(row.periodId) ?? []),
        row.facultyId,
      ]);
  }

  return sessions.map((session) => ({
    ...session,
    classes: (session.classes ?? []).map((cls) => {
      const sections = byClass.get(String(cls.id)) ?? [];
      const capacity = sections.reduce((total, section) => total + section.capacity, 0);
      const timetables = (cls.timetables ?? []).map((timetable) => ({
        ...timetable,
        periods: (timetable.periods ?? []).map((period) => ({
          ...period,
          assistantFacultyIds: assistantsByPeriod.get(period.id) ?? [],
        })),
      }));
      return {
        ...cls,
        sections,
        timetables,
        ...(sections.length > 0 ? { maxStudents: capacity } : {}),
      };
    }),
  }));
}
