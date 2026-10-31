import { and, eq, inArray, isNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Enrollment } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import {
  ENROLLMENT_COLUMNS,
  enrollmentRowToRecord,
  loadTimelineMapTx,
} from "./enrollmentProjection.js";

export { enrollmentRowToRecord } from "./enrollmentProjection.js";

export async function listEnrollmentsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<Enrollment[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, subdomain), isNull(enrollments.deletedAt)))
      .orderBy(enrollments.id)
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];
    const timeline = await loadTimelineMapTx(
      tx,
      subdomain,
      rows.map((row) => row.id),
    );
    return rows.map((row) => enrollmentRowToRecord(row, timeline.get(row.id)));
  });
}

export async function findEnrollmentById(tenant: string, id: string): Promise<Enrollment | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, subdomain), eq(enrollments.id, id)));
    if (!row) return null;
    const timeline = await loadTimelineMapTx(tx, subdomain, [row.id]);
    return enrollmentRowToRecord(row, timeline.get(row.id));
  });
}

export async function findEnrollmentsByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Enrollment[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(enrollments.workspaceSubdomain, subdomain),
      inArray(enrollments.id, cleanIds),
    ];
    if (!options?.includeDeleted) conditions.push(isNull(enrollments.deletedAt));
    const rows = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(...conditions));
    if (rows.length === 0) return [];
    const timeline = await loadTimelineMapTx(tx, subdomain, cleanIds);
    return rows.map((row) => enrollmentRowToRecord(row, timeline.get(row.id)));
  });
}
