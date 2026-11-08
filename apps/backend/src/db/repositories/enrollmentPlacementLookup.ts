import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { enrollments } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";

export interface EnrollmentPlacementRow {
  studentId: string;
  classId: string;
  sectionId: string | null;
}

/** Live enrollment placements (student × class → section) for the given classes and students. */
export async function listEnrollmentPlacementsTx(
  tx: TenantTransaction,
  subdomain: string,
  classIds: readonly string[],
  studentIds: readonly string[],
  options: { sectionedOnly?: boolean } = {},
): Promise<EnrollmentPlacementRow[]> {
  if (classIds.length === 0 || studentIds.length === 0) return [];
  const filters = [
    eq(enrollments.workspaceSubdomain, subdomain),
    inArray(enrollments.classId, [...classIds]),
    inArray(enrollments.studentId, [...studentIds]),
    isNull(enrollments.deletedAt),
  ];
  if (options.sectionedOnly) filters.push(isNotNull(enrollments.sectionId));
  return tx
    .select({
      studentId: enrollments.studentId,
      classId: enrollments.classId,
      sectionId: enrollments.sectionId,
    })
    .from(enrollments)
    .where(and(...filters));
}

export async function listEnrollmentPlacements(
  tenant: string,
  classIds: readonly string[],
  studentIds: readonly string[],
  options: { sectionedOnly?: boolean } = {},
): Promise<EnrollmentPlacementRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) =>
    listEnrollmentPlacementsTx(tx, subdomain, classIds, studentIds, options),
  );
}

/**
 * Placement section **as of a date** (attendance history): the placement row covering that
 * day, newest first. Placements are kept after a withdrawal/trash, so a backfilled mark keeps
 * the section of record instead of the student's current section.
 */
export async function listEnrollmentPlacementsAsOfTx(
  tx: TenantTransaction,
  subdomain: string,
  classIds: readonly string[],
  studentIds: readonly string[],
  asOf: string,
): Promise<EnrollmentPlacementRow[]> {
  if (classIds.length === 0 || studentIds.length === 0) return [];
  const classList = sql.join(
    classIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const studentList = sql.join(
    studentIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await tx.execute<EnrollmentPlacementRow & Record<string, unknown>>(sql`
    SELECT DISTINCT ON (e.student_id, p.class_id)
           e.student_id AS "studentId", p.class_id AS "classId", p.section_id AS "sectionId"
      FROM enrollment_placements p
      JOIN enrollments e
        ON e.workspace_subdomain = p.workspace_subdomain AND e.id = p.enrollment_id
     WHERE p.workspace_subdomain = ${subdomain}
       AND p.class_id IN (${classList})
       AND e.student_id IN (${studentList})
       AND p.start_on <= ${asOf}
       AND (p.end_on IS NULL OR p.end_on >= ${asOf})
     ORDER BY e.student_id, p.class_id, p.start_on DESC
  `);
  return result.rows as EnrollmentPlacementRow[];
}

export async function listEnrollmentPlacementsAsOf(
  tenant: string,
  classIds: readonly string[],
  studentIds: readonly string[],
  asOf: string,
): Promise<EnrollmentPlacementRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) =>
    listEnrollmentPlacementsAsOfTx(tx, subdomain, classIds, studentIds, asOf),
  );
}

/** Most recent live enrollment of a student in a class, if any. */
export async function findLatestEnrollmentId(
  tenant: string,
  studentId: string,
  classId: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenantRead(subdomain, (tx) =>
    tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.studentId, studentId),
          eq(enrollments.classId, classId),
          isNull(enrollments.deletedAt),
        ),
      )
      .orderBy(desc(enrollments.createdAt))
      .limit(1),
  );
  return row?.id ?? null;
}
