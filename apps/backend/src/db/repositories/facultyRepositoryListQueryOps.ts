import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { FacultyMember } from "@mms/shared";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { FACULTY_PROJECTION_COLUMNS, facultyRowToRecord } from "./facultyRepositoryColumns.js";

export {
  listFacultyLinkedContactIdsSql,
  findSoftDeletedFacultyByContactIdSql,
  findFacultyRegistrationConflictSql,
} from "./facultyRepositoryListContactOps.js";

export async function countFacultyActive(
  tenant: string,
  options?: { includeDeleted?: boolean },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const whereClause = options?.includeDeleted
      ? eq(faculty.workspaceSubdomain, subdomain)
      : and(eq(faculty.workspaceSubdomain, subdomain), isNull(faculty.deletedAt));
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(faculty)
      .where(whereClause);
    return Number(rows[0]?.count ?? 0);
  });
}

export interface NextEmployeeIdCountOptions {
  prefix?: string;
  restartAnnually?: boolean;
  year?: number;
}

/**
 * Derives the sequence watermark for next employee-id generation.
 * Calculates total records (including soft-deleted) plus the highest numeric suffix
 * found in existing employee IDs so IDs are monotonic and safe against deletions.
 */
export async function countFacultyForNextEmployeeId(
  tenant: string,
  options?: NextEmployeeIdCountOptions,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(facultyEmployments)
      .where(eq(facultyEmployments.workspaceSubdomain, subdomain));
    const totalCount = Number(countRows[0]?.count ?? 0);

    const seqConditions: SQL[] = [eq(facultyEmployments.workspaceSubdomain, subdomain)];
    if (options?.prefix?.trim()) {
      seqConditions.push(
        sql`${facultyEmployments.employeeId} ILIKE ${options.prefix.trim() + "%"}`,
      );
    }
    if (options?.restartAnnually && options.year) {
      seqConditions.push(sql`${facultyEmployments.employeeId} LIKE ${"%" + options.year + "%"}`);
    }

    const maxRows = await tx
      .select({
        maxSeq: sql<number>`COALESCE(MAX(NULLIF(substring(${facultyEmployments.employeeId} from '(\\d+)$'), '')::bigint), 0)::int`,
      })
      .from(facultyEmployments)
      .where(and(...seqConditions));
    const maxSeq = Number(maxRows[0]?.maxSeq ?? 0);

    return Math.max(totalCount, maxSeq);
  });
}

/** Active faculty missing typed `employee_id` (null or blank) — backfill candidates. */
export async function listActiveFacultyMissingEmployeeId(
  workspaceSubdomain: string,
): Promise<FacultyMember[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .innerJoin(
        facultyEmployments,
        and(
          eq(faculty.workspaceSubdomain, facultyEmployments.workspaceSubdomain),
          eq(faculty.employmentId, facultyEmployments.id),
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          isNull(faculty.deletedAt),
          sql`NULLIF(trim(COALESCE(${facultyEmployments.employeeId}, '')), '') IS NULL`,
        ),
      )
      .orderBy(asc(faculty.id));
    return rows.map(facultyRowToRecord);
  });
}
