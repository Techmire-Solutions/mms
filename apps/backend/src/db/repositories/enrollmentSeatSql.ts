import { notInArray, sql, type SQL } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { enrollments } from "../schema.js";

const released = sql.join(
  SEAT_RELEASED_ENROLLMENT_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

/**
 * `<alias>.status` still occupies a seat (not cancelled / withdrawn) — the one SQL form of
 * `enrollmentHoldsSeat` for raw queries over `enrollments <alias>`.
 */
export function enrollmentHoldsSeatSql(alias: string): SQL {
  return sql`${sql.identifier(alias)}.status NOT IN (${released})`;
}

/** Drizzle-builder form of {@link enrollmentHoldsSeatSql} for queries on `enrollments`. */
export function enrollmentHoldsSeatWhere(): SQL {
  return notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]);
}
