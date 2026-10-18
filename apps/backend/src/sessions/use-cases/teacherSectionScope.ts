import { sql } from 'drizzle-orm';
import { roleHasPermission, type User } from '@mms/shared';
import { withTenantRead } from '../../db/tenant-context.js';
import { HttpDomainError } from '../../lib/httpErrors.js';

/** Users with this permission (admins, coordinators) are never section-scoped. */
export const SECTION_SCOPE_BYPASS_PERMISSION = 'sessions.delete' as const;

export interface ClassOnDate {
  classId: string;
  /** YYYY-MM-DD business date of the record (attendance day / exam date). */
  date: string;
}

const pairKey = (entry: ClassOnDate) => `${entry.classId}|${entry.date.slice(0, 10)}`;

/**
 * Pairs the user does NOT teach on that date, or `null` when the user is not section-scoped
 * (coordinator rights, or not linked to a faculty record).
 */
async function findUntaughtPairs(user: User, tenant: string, entries: readonly ClassOnDate[]): Promise<Set<string> | null> {
  if (roleHasPermission(user.role, SECTION_SCOPE_BYPASS_PERMISSION)) return null;
  const subdomain = tenant.trim().toLowerCase();
  const pairs = [...new Map(entries.filter((e) => e.classId && e.date).map((e) => [pairKey(e), e])).values()];

  return withTenantRead(subdomain, async (tx) => {
    const linked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM faculty WHERE workspace_subdomain = ${subdomain} AND user_id = ${user.id} AND deleted_at IS NULL
    `);
    const facultyIds = linked.rows.map((row) => row.id);
    if (facultyIds.length === 0) return null;
    if (pairs.length === 0) return new Set<string>();
    const ids = sql.join(facultyIds.map((id) => sql`${id}`), sql`, `);
    const values = sql.join(pairs.map((p) => sql`(${p.classId}::text, ${p.date.slice(0, 10)}::date)`), sql`, `);
    const result = await tx.execute<{ classId: string; onDate: string }>(sql`
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
    return new Set(result.rows.map((row) => pairKey({ classId: row.classId, date: row.onDate })));
  });
}

function forbidden(): HttpDomainError {
  return new HttpDomainError(403, 'forbidden', 'You can only record entries for classes you teach on that date');
}

/**
 * Standard teacher row-scope: a faculty-linked user without coordinator rights may only mark
 * attendance for classes where they teach on that date — an active section staff assignment
 * (any role, incl. assistant) or a timetable period (primary or assistant teacher).
 */
export async function assertTeacherClassScope(user: User, tenant: string, entries: readonly ClassOnDate[]): Promise<void> {
  if (entries.length === 0) return;
  const untaught = await findUntaughtPairs(user, tenant, entries);
  if (untaught && untaught.size > 0) throw forbidden();
}

/** Each group passes when the user teaches at least one of its classes (e.g. an exam held for several classes). */
export async function assertTeacherAnyClassScope(user: User, tenant: string, groups: readonly (readonly ClassOnDate[])[]): Promise<void> {
  const nonEmpty = groups.filter((group) => group.length > 0);
  if (nonEmpty.length === 0) return;
  const untaught = await findUntaughtPairs(user, tenant, nonEmpty.flat());
  if (untaught && nonEmpty.some((group) => group.every((entry) => untaught.has(pairKey(entry))))) throw forbidden();
}
