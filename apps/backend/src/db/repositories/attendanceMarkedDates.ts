import { sql } from "drizzle-orm";
import type { AttendanceMarkedDatesQuery } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Distinct days in range that carry at least one live attendance row.
 *
 * Served by `attendance_workspace_class_date_on_active_idx`, so the scan stays on the index even
 * over a full academic year.
 */
export async function listMarkedAttendanceDatesSql(
  tenant: string,
  query: AttendanceMarkedDatesQuery,
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return [];
  const classId = query.classId?.trim();
  const sectionId = query.sectionId?.trim();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{ date_on: string }>(sql`
      SELECT DISTINCT a.date_on
        FROM attendance a
       WHERE a.workspace_subdomain = ${subdomain}
         AND a.deleted_at IS NULL
         AND a.date_on >= ${query.from}
         AND a.date_on <= ${query.to}
         ${classId ? sql`AND a.class_id = ${classId}` : sql``}
         ${sectionId ? sql`AND a.section_id = ${sectionId}` : sql``}
       ORDER BY a.date_on`);
    return getQueryRows<{ date_on: string }>(result).map((row) => String(row.date_on));
  });
}
