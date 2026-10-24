import { and, eq, sql } from "drizzle-orm";
import type { StudentsListPageResult, StudentsListQuery } from "@mms/shared";
import { isQueryFlagTrue } from "@mms/shared";
import { students, contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { hydrateStudentsList } from "./studentRepository.js";
import { buildListConditions, buildOrderBy } from "./studentRepositoryListQuery.js";
import { STUDENT_COLUMNS_LIST } from "./studentRepositoryColumns.js";

/**
 * SQL-filtered students Work list page (typed deleted_at + relational filters).
 * includeDeleted → deleted-only (Contacts trash parity).
 */
export async function listStudentsPage(
  tenant: string,
  query: StudentsListQuery & { afterId?: string; skipCount?: boolean },
): Promise<StudentsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(1, query.limit ?? 50), 500);
  const isCursorPaging = Boolean(query.afterId?.trim());
  const offset = isCursorPaging ? 0 : (page - 1) * limit;
  const includeDeleted = isQueryFlagTrue(query.includeDeleted);

  return withTenantRead(subdomain, async (tx) => {
    if (includeDeleted) await enableIncludeDeleted(tx);
    const needsContactsJoin = Boolean(
      query.gender?.trim() ||
      query.search?.trim() ||
      (!isCursorPaging &&
        query.sortField &&
        ["name", "gender", "dob"].includes(query.sortField.trim())),
    );
    const conditions = buildListConditions(subdomain, query, needsContactsJoin);
    const baseWhereClause = and(...conditions);
    if (isCursorPaging) {
      conditions.push(sql`${students.id} > ${query.afterId!.trim()}`);
    }
    const whereClause = and(...conditions);
    const effectiveOrderBy = isCursorPaging
      ? sql`${students.id} asc`
      : buildOrderBy(query.sortField, query.sortDir, needsContactsJoin);

    let total = 0;
    if (!query.skipCount) {
      const countRows = needsContactsJoin
        ? await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(students)
            .leftJoin(
              contacts,
              and(
                eq(contacts.workspaceSubdomain, students.workspaceSubdomain),
                eq(contacts.id, students.contactId),
              ),
            )
            .where(baseWhereClause)
        : await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(students)
            .where(baseWhereClause);
      total = Number(countRows[0]?.count ?? 0);
    }

    const rows = needsContactsJoin
      ? await tx
          // STUDENT_COLUMNS_LIST omits `notes` to reduce bandwidth on list pages.
          .select(STUDENT_COLUMNS_LIST)
          .from(students)
          .leftJoin(
            contacts,
            and(
              eq(contacts.workspaceSubdomain, students.workspaceSubdomain),
              eq(contacts.id, students.contactId),
            ),
          )
          .where(whereClause)
          .orderBy(effectiveOrderBy)
          .limit(limit)
          .offset(offset)
      : await tx
          .select(STUDENT_COLUMNS_LIST)
          .from(students)
          .where(whereClause)
          .orderBy(effectiveOrderBy)
          .limit(limit)
          .offset(offset);

    const hydratedStudents = await hydrateStudentsList(tx, subdomain, rows);
    const hasMore = isCursorPaging ? rows.length === limit : page * limit < total;
    const lastRow = rows[rows.length - 1];
    const nextCursor = isCursorPaging && hasMore && lastRow ? lastRow.id : undefined;

    return {
      students: hydratedStudents,
      total,
      page,
      limit,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    };
  });
}
