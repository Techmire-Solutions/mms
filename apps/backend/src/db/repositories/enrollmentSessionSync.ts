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
 * `enrollments` is the source of truth for student ↔ session membership; the
 * `student_session_memberships` view reads it (migration 0181). Legacy pairs without enrollment history live in
 * `student_enrolled_sessions_legacy`; once a student gets any enrollment in that session the
 * legacy pair is consumed here, inside the same transaction, so membership follows enrollments.
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
  await tx.execute(sql`
    DELETE FROM student_enrolled_sessions_legacy s
     USING enrollments e
     WHERE s.workspace_subdomain = ${subdomain}
       AND e.workspace_subdomain = s.workspace_subdomain
       AND e.student_id = s.student_id AND e.session_id = s.session_id
       AND (${sql.join(filters, sql` OR `)})
  `);
}
