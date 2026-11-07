import { and, eq, isNull, sql } from "drizzle-orm";
import { enrollmentHoldsSeatWhere } from "./enrollmentSeatSql.js";
import { enrollments, sessions } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Store reads/writes the session transition service needs. Every function takes the ambient
 * transaction so the guard counts, the status write, the side effects and the audit row share one
 * atomic boundary (`sessionLifecycleOpsUseCases` / `useCases` wrap in `withTenant`).
 */

export interface LockedSessionRow {
  id: string;
  status: string;
  version: number;
  updatedAt: Date;
  startDate: string | null;
  endDate: string | null;
}

/** Locks the session row for the transition, excluding trashed sessions. */
export async function lockSessionForTransitionTx(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
): Promise<LockedSessionRow | null> {
  const [row] = await tx
    .select({
      id: sessions.id,
      status: sessions.status,
      version: sessions.version,
      updatedAt: sessions.updatedAt,
      startDate: sessions.startDate,
      endDate: sessions.endDate,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.workspaceSubdomain, subdomain),
        eq(sessions.id, id),
        isNull(sessions.deletedAt),
      ),
    )
    .for("update");
  return (row as LockedSessionRow | undefined) ?? null;
}

/**
 * Compare-and-set status write. `from` (and the optional version) must still match, so a concurrent
 * transition/auto-start cannot be overwritten. Returns false when the row changed under us.
 */
export async function updateSessionStatusIfTx(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
  from: string,
  to: string,
  expectedVersion?: number,
): Promise<boolean> {
  const conditions = [
    eq(sessions.workspaceSubdomain, subdomain),
    eq(sessions.id, id),
    isNull(sessions.deletedAt),
    eq(sessions.status, from),
  ];
  if (expectedVersion !== undefined) conditions.push(eq(sessions.version, expectedVersion));
  const updated = await tx
    .update(sessions)
    .set({ status: to, updatedAt: new Date(), version: sql`${sessions.version} + 1` })
    .where(and(...conditions))
    .returning({ id: sessions.id });
  return updated.length > 0;
}

/** Seat-holding enrollments of a session (the same definition every list/capacity query uses). */
export async function countLiveEnrollmentsTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<number> {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        eq(enrollments.sessionId, sessionId),
        isNull(enrollments.deletedAt),
        enrollmentHoldsSeatWhere(),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Recorded teaching for the session (any class), used to refuse re-opening a used session. */
export async function countSessionAttendanceTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<number> {
  const result = await tx.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
      FROM attendance a
      JOIN session_classes c
        ON c.workspace_subdomain = a.workspace_subdomain AND c.id = a.class_id
     WHERE c.workspace_subdomain = ${subdomain} AND c.session_id = ${sessionId}
  `);
  return Number(result.rows[0]?.count ?? 0);
}

/** Exam results recorded for any class of the session. */
export async function countSessionExamResultsTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<number> {
  const result = await tx.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
      FROM exam_results r
      JOIN exam_classes ec
        ON ec.workspace_subdomain = r.workspace_subdomain AND ec.exam_id = r.exam_id
      JOIN session_classes c
        ON c.workspace_subdomain = ec.workspace_subdomain AND c.id = ec.class_id
     WHERE c.workspace_subdomain = ${subdomain} AND c.session_id = ${sessionId}
  `);
  return Number(result.rows[0]?.count ?? 0);
}

/** Whether any class of the session has a budget plan (the `requireBudget` activation gate). */
export async function sessionHasBudgetTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<boolean> {
  const result = await tx.execute<{ found: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
        FROM session_class_budgets b
        JOIN session_classes c
          ON c.workspace_subdomain = b.workspace_subdomain AND c.id = b.session_class_id
       WHERE c.workspace_subdomain = ${subdomain} AND c.session_id = ${sessionId}
    ) AS found
  `);
  return result.rows[0]?.found === true;
}

/**
 * Bounds an end-date shrink may not cross: the last attendance day and the furthest live enrollment
 * boundary (start or end). Returns ISO days.
 */
export async function sessionDateBoundsTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
): Promise<{ lastAttendanceDate: string | null; lastEnrollmentDate: string | null }> {
  const result = await tx.execute<{
    lastAttendanceDate: string | null;
    lastEnrollmentDate: string | null;
  }>(sql`
    SELECT
      (SELECT to_char(max(a.date_on), 'YYYY-MM-DD')
         FROM attendance a
         JOIN session_classes c
           ON c.workspace_subdomain = a.workspace_subdomain AND c.id = a.class_id
        WHERE c.workspace_subdomain = ${subdomain} AND c.session_id = ${sessionId}) AS "lastAttendanceDate",
      (SELECT to_char(max(GREATEST(COALESCE(e.end_on, e.start_on, e.enrolled_on), COALESCE(e.start_on, e.enrolled_on))), 'YYYY-MM-DD')
         FROM enrollments e
        WHERE e.workspace_subdomain = ${subdomain} AND e.session_id = ${sessionId}
          AND e.deleted_at IS NULL) AS "lastEnrollmentDate"
  `);
  return {
    lastAttendanceDate: result.rows[0]?.lastAttendanceDate ?? null,
    lastEnrollmentDate: result.rows[0]?.lastEnrollmentDate ?? null,
  };
}

/**
 * Moves the session's dependent calendar days by `deltaDays`: class enrollment deadlines (stored as
 * `YYYY-MM-DD` text until the date-column conversion lands) and session-scoped calendar events.
 * Runs in the postpone transaction so the term boundary moves atomically with the session itself.
 */
export async function shiftSessionDependentDatesTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
  deltaDays: number,
): Promise<void> {
  if (!Number.isInteger(deltaDays) || deltaDays === 0) return;
  await tx.execute(sql`
    UPDATE session_classes
       SET enrollment_deadline = to_char(
             left(btrim(enrollment_deadline), 10)::date + ${deltaDays}::int,
             'YYYY-MM-DD'
           ),
           updated_at = now(),
           version = version + 1
     WHERE workspace_subdomain = ${subdomain} AND session_id = ${sessionId}
       AND enrollment_deadline ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
  `);
  await tx.execute(sql`
    UPDATE academic_calendar_events
       SET start_on = start_on + ${deltaDays}::int,
           end_on = end_on + ${deltaDays}::int,
           updated_at = now()
     WHERE workspace_subdomain = ${subdomain} AND session_id = ${sessionId}
       AND deleted_at IS NULL
  `);
}
