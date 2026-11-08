import { and, asc, eq } from "drizzle-orm";
import type { EnrollmentPlacement } from "@mms/shared";
import { enrollmentPlacements } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Timeline of an enrollment's class/section placements (migration 0175).
 *
 * Split out of `enrollmentOperationsRepository.ts` (300-line ceiling) and re-exported
 * there, so the module's public surface is unchanged.
 */
export async function listEnrollmentPlacements(
  tenant: string,
  enrollmentId: string,
): Promise<EnrollmentPlacement[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) =>
    tx
      .select({
        id: enrollmentPlacements.id,
        enrollmentId: enrollmentPlacements.enrollmentId,
        classId: enrollmentPlacements.classId,
        sectionId: enrollmentPlacements.sectionId,
        startOn: enrollmentPlacements.startOn,
        endOn: enrollmentPlacements.endOn,
        reason: enrollmentPlacements.reason,
      })
      .from(enrollmentPlacements)
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          eq(enrollmentPlacements.enrollmentId, enrollmentId),
        ),
      )
      .orderBy(asc(enrollmentPlacements.startOn)),
  );
}
