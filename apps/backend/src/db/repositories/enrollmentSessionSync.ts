import { sql, type SQL } from "drizzle-orm";

export interface EnrolledSessionSyncScope {
  studentIds?: readonly string[];
  sessionIds?: readonly string[];
  enrollmentIds?: readonly string[];
}

/** Any Drizzle client/transaction able to run raw SQL (cascades pass the base client type). */
type SqlExecutor = { execute: (query: SQL) => PromiseLike<unknown> };

const list = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

/**
 * `enrollments` is the source of truth for student ↔ session membership; this keeps the
 * derived `student_enrolled_sessions` rows in step inside the same transaction:
 * - adds a pair for every active (live, non-cancelled) enrollment;
 * - removes a pair only when the student has enrollment history in that session but no
 *   active enrollment (legacy class-less pairs without any enrollment are left untouched).
 */
export async function syncEnrolledSessionsTx(
  tx: SqlExecutor,
  subdomain: string,
  scope: EnrolledSessionSyncScope,
): Promise<void> {
  const filters: SQL[] = [];
  if (scope.studentIds?.length) filters.push(sql`e.student_id IN (${list(scope.studentIds)})`);
  if (scope.sessionIds?.length) filters.push(sql`e.session_id IN (${list(scope.sessionIds)})`);
  if (scope.enrollmentIds?.length) filters.push(sql`e.id IN (${list(scope.enrollmentIds)})`);
  if (filters.length === 0) return;

  // History includes archived enrollments, which FORCE RLS hides by default.
  await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
  const targets = sql`
    SELECT DISTINCT e.student_id FROM enrollments e
     WHERE e.workspace_subdomain = ${subdomain} AND (${sql.join(filters, sql` OR `)})
  `;

  await tx.execute(sql`
    DELETE FROM student_enrolled_sessions s
     WHERE s.workspace_subdomain = ${subdomain}
       AND s.student_id IN (${targets})
       AND EXISTS (
         SELECT 1 FROM enrollments h
          WHERE h.workspace_subdomain = s.workspace_subdomain AND h.student_id = s.student_id AND h.session_id = s.session_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM enrollments a
          WHERE a.workspace_subdomain = s.workspace_subdomain AND a.student_id = s.student_id AND a.session_id = s.session_id
            AND a.deleted_at IS NULL AND a.status <> 'cancelled'
       )
  `);

  await tx.execute(sql`
    INSERT INTO student_enrolled_sessions (id, workspace_subdomain, student_id, session_id, sort_order)
    SELECT DISTINCT a.student_id || '_sess_' || md5(a.session_id), a.workspace_subdomain, a.student_id, a.session_id, 0
      FROM enrollments a
     WHERE a.workspace_subdomain = ${subdomain}
       AND a.student_id IN (${targets})
       AND a.deleted_at IS NULL AND a.status <> 'cancelled'
       AND EXISTS (SELECT 1 FROM sessions ses WHERE ses.workspace_subdomain = a.workspace_subdomain AND ses.id = a.session_id)
    ON CONFLICT (workspace_subdomain, student_id, session_id) DO NOTHING
  `);
}
