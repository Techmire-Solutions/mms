/**
 * @file facultyEmploymentCascade.ts
 * @description Cascade soft-delete / restore for faculty_employments (+ audit/outbox).
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import {
  auditEmploymentEntityRestores,
  auditEmploymentEntitySoftDeletes,
} from "./facultyEmploymentEntityAudit.js";

export async function cascadeSoftDeleteFacultyEmployments(
  tenant: string,
  facultyIds: string[],
  deletedBy: string,
  deletionReason?: string,
): Promise<number> {
  if (facultyIds.length === 0) return 0;
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  const reason = deletionReason
    ? `Cascade: parent faculty deleted (${deletionReason})`
    : "Cascade: parent faculty deleted";
  return withTenant(subdomain, async (tx) => {
    const links = await tx
      .select({ employmentId: faculty.employmentId })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          inArray(faculty.id, facultyIds),
          isNotNull(faculty.employmentId),
        ),
      );
    const employmentIds = links
      .map((row) => row.employmentId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (employmentIds.length === 0) return 0;
    const changed = await tx
      .update(facultyEmployments)
      .set({
        deletedAt: now,
        deletedBy,
        deletionReason: reason,
        deletedWithCascade: true,
        updatedAt: now,
      })
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          inArray(facultyEmployments.id, employmentIds),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .returning({ id: facultyEmployments.id });
    await auditEmploymentEntitySoftDeletes(
      tx,
      subdomain,
      "faculty_employments",
      changed.map((row) => row.id),
      deletedBy,
      reason,
      now,
    );
    return changed.length;
  });
}

export async function cascadeRestoreFacultyEmployments(
  tenant: string,
  facultyIds: string[],
  restoredBy?: string,
): Promise<number> {
  if (facultyIds.length === 0) return 0;
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const links = await tx
      .select({ employmentId: faculty.employmentId })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          inArray(faculty.id, facultyIds),
          isNotNull(faculty.employmentId),
        ),
      );
    const employmentIds = links
      .map((row) => row.employmentId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (employmentIds.length === 0) return 0;
    const changed = await tx
      .update(facultyEmployments)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: restoredBy ?? null,
        deletedWithCascade: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          inArray(facultyEmployments.id, employmentIds),
          isNotNull(facultyEmployments.deletedAt),
          eq(facultyEmployments.deletedWithCascade, true),
        ),
      )
      .returning({ id: facultyEmployments.id });
    await auditEmploymentEntityRestores(
      tx,
      subdomain,
      "faculty_employments",
      changed.map((row) => row.id),
      restoredBy,
      now,
    );
    return changed.length;
  });
}
