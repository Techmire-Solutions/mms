import {
  FACULTY_MODULE_MANIFEST,
  type FacultyListPageResult,
  type FacultyListQuery,
  type FacultyMember,
} from "@mms/shared";
import { and, sql } from "drizzle-orm";
import { faculty } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { facultyRowToRecord } from "./facultyRepositoryColumns.js";
import { countSubordinatesBatch } from "./facultyRepositorySubordinates.js";
import { buildListConditions, buildOrderBy } from "./facultyRepositoryListQuerySql.js";
import { facultyWithPrimaryAppointmentFromSql } from "./facultyPrimaryAppointmentSql.js";

type ListRow = typeof faculty.$inferSelect & {
  departmentId?: string | null;
  designationId?: string | null;
  departmentName?: string | null;
  designationName?: string | null;
  parentDesignationId?: string | null;
  hierarchyRank?: number | null;
};

/**
 * SQL-filtered faculty Work list page with LATERAL primary-appointment joins
 * so filter/sort/search/count do not re-probe FA per row via scalar subqueries.
 * Projects pa_* columns so page hydrate skips a second appointment round-trip.
 */
export async function listFacultyPage(
  tenant: string,
  query: FacultyListQuery & { includeDeleted?: boolean; afterId?: string; skipCount?: boolean },
): Promise<FacultyListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      Math.max(1, query.limit ?? FACULTY_MODULE_MANIFEST.defaultPageSize),
      100,
    );
    const isCursorPaging = Boolean(query.afterId?.trim());
    const offset = isCursorPaging ? 0 : (page - 1) * limit;

    const conditions = buildListConditions(subdomain, query);
    const baseWhere = and(...conditions);
    const pageConditions = [...conditions];
    if (isCursorPaging) {
      pageConditions.push(sql`${faculty.id} > ${query.afterId!.trim()}`);
    }
    const pageWhere = and(...pageConditions);

    const fromSql = facultyWithPrimaryAppointmentFromSql();
    const sortDir = query.sortDir === "desc" ? "desc" : query.sortDir === "asc" ? "asc" : undefined;
    const orderBy = isCursorPaging
      ? sql`${faculty.id} asc`
      : sql`${buildOrderBy(query.sortField, sortDir)}, ${faculty.id} asc`;

    let total = 0;
    if (!query.skipCount) {
      const countResult = await tx.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count
        ${fromSql}
        WHERE ${baseWhere}
      `);
      total = Number(countResult.rows[0]?.count ?? 0);
    }

    const rowsResult = await tx.execute(sql`
      SELECT
        ${faculty.id} AS id,
        ${faculty.workspaceSubdomain} AS "workspaceSubdomain",
        fe_emp.contact_id AS "contactId",
        ${faculty.employmentId} AS "employmentId",
        ${faculty.userId} AS "userId",
        fe_emp.employee_id AS "employeeId",
        fe_desig.designation_id AS "designationId",
        fe_desig.start_date AS "designationStartDate",
        fe_desig.end_date AS "designationEndDate",
        ${faculty.profileStatus} AS "profileStatus",
        COALESCE(fe_emp.status, 'active') AS status,
        ${faculty.specialization} AS specialization,
        ${faculty.qualification} AS qualification,
        fe_emp.employment_start_date AS "employmentStartDate",
        fe_emp.employment_end_date AS "employmentEndDate",
        ${faculty.performanceRating} AS "performanceRating",
        fe_emp.employment_start_date AS "joinDate",
        ${faculty.notes} AS notes,
        ${faculty.customData} AS "customData",
        ${faculty.deletedAt} AS "deletedAt",
        ${faculty.deletedBy} AS "deletedBy",
        ${faculty.deletionReason} AS "deletionReason",
        ${faculty.restoredAt} AS "restoredAt",
        ${faculty.restoredBy} AS "restoredBy",
        ${faculty.deletedWithCascade} AS "deletedWithCascade",
        ${faculty.createdAt} AS "createdAt",
        ${faculty.updatedAt} AS "updatedAt",
        ${faculty.createdBy} AS "createdBy",
        ${faculty.updatedBy} AS "updatedBy",
        pa_desig.department_id AS "departmentId",
        pa_dept.name AS "departmentName",
        pa_desig.name AS "designationName",
        pa_desig.parent_designation_id AS "parentDesignationId",
        pa_desig.hierarchy_rank AS "hierarchyRank"
      ${fromSql}
      WHERE ${pageWhere}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const mapped: FacultyMember[] = (rowsResult.rows as unknown as ListRow[]).map((row) => {
      const base = facultyRowToRecord(row);
      return {
        ...base,
        ...(row.departmentId ? { departmentId: row.departmentId } : {}),
        ...(row.parentDesignationId ? { parentDesignationId: row.parentDesignationId } : {}),
        ...(row.departmentName ? { department: row.departmentName } : {}),
        ...(row.designationName ? { designation: row.designationName } : {}),
        ...(row.hierarchyRank != null ? { hierarchyRank: Number(row.hierarchyRank) } : {}),
      };
    });
    const itemIds = mapped.map((t) => String(t.id));
    const subCounts = await countSubordinatesBatch(subdomain, itemIds);
    const enriched: FacultyMember[] = mapped.map((t) => ({
      ...t,
      subordinateCount: subCounts[String(t.id)] ?? 0,
    }));

    const hasMore =
      isCursorPaging || query.skipCount ? enriched.length === limit : page * limit < total;
    const lastItem = enriched[enriched.length - 1];
    return {
      faculty: enriched,
      total,
      page,
      limit,
      hasMore,
      ...(isCursorPaging && lastItem ? { nextCursor: String(lastItem.id) } : {}),
    };
  });
}
