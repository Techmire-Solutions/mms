import { sql, type SQL } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { enrollments, students } from "../schema.js";

const SEAT_RELEASED_STATUSES_SQL = sql.join(
  SEAT_RELEASED_ENROLLMENT_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

/**
 * Correlated predicate that keeps only students currently enrolled in one of the
 * caller's assigned sections.
 *
 * Uses the same "active membership" rule as seat accounting: an enrollment in a
 * seat-releasing status (withdrawn/cancelled/promoted/...) no longer grants a
 * section-limited teacher visibility. `1 = 0` is emitted for an empty scope so a
 * caller can never accidentally widen the result set.
 */
export function studentScopeExistsSql(subdomain: string, sectionIds: string[]): SQL {
  if (sectionIds.length === 0) return sql`1 = 0`;
  const sectionList = sql.join(
    sectionIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`EXISTS (
    SELECT 1 FROM ${enrollments} e
    WHERE e.workspace_subdomain = ${subdomain}
      AND e.student_id = ${students.id}
      AND e.deleted_at IS NULL
      AND e.section_id IN (${sectionList})
      AND e.status NOT IN (${SEAT_RELEASED_STATUSES_SQL})
  )`;
}
