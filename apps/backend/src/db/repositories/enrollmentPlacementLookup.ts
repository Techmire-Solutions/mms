import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
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
