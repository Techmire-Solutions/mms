import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";
import { facultyAssignments } from "../schema.js";

/** Calendar-effective primary active appointment (matches designation batch loaders). */
export function primaryAssignmentEffectiveOnDateSql(tableAlias = "a"): SQL {
  const startCol = `${tableAlias}.start_date`;
  const endCol = `${tableAlias}.end_date`;
  return sql`${sql.raw(startCol)} <= CURRENT_DATE
    AND (${sql.raw(endCol)} IS NULL OR ${sql.raw(endCol)} >= CURRENT_DATE)`;
}

/** Drizzle WHERE fragment for primary + active + not deleted + effective today. */
export function primaryAssignmentEffectiveTodayWhere() {
  const onDate = new Date().toISOString().slice(0, 10);
  return and(
    eq(facultyAssignments.isPrimary, true),
    eq(facultyAssignments.status, "active"),
    isNull(facultyAssignments.deletedAt),
    lte(facultyAssignments.startDate, onDate),
    or(isNull(facultyAssignments.endDate), gte(facultyAssignments.endDate, onDate)),
  );
}
