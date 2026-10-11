/**
 * @file facultyEmployDesignationCascade.ts
 * @description Cascade soft-delete / restore for faculty_employ_designations (+ audit/outbox).
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { faculty, facultyEmployDesignations } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import {
  auditEmploymentEntityRestores,
  auditEmploymentEntitySoftDeletes,
} from "./facultyEmploymentEntityAudit.js";

export async function cascadeSoftDeleteFacultyEmployDesignations(
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
      .update(facultyEmployDesignations)
      .set({
        deletedAt: now,
        deletedBy,
        deletionReason: reason,
        deletedWithCascade: true,
        updatedAt: now,
      })
      .where(
        and(
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          inArray(facultyEmployDesignations.employmentId, employmentIds),
          isNull(facultyEmployDesignations.deletedAt),
        ),
      )
      .returning({ id: facultyEmployDesignations.id });
    await auditEmploymentEntitySoftDeletes(
      tx,
      subdomain,
      "faculty_employ_designations",
      changed.map((row) => row.id),
      deletedBy,
      reason,
      now,
    );
    return changed.length;
  });
}

export async function cascadeRestoreFacultyEmployDesignations(
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
      .update(facultyEmployDesignations)
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
          eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
          inArray(facultyEmployDesignations.employmentId, employmentIds),
          isNotNull(facultyEmployDesignations.deletedAt),
          eq(facultyEmployDesignations.deletedWithCascade, true),
        ),
      )
      .returning({ id: facultyEmployDesignations.id });
    await auditEmploymentEntityRestores(
      tx,
      subdomain,
      "faculty_employ_designations",
      changed.map((row) => row.id),
      restoredBy,
      now,
    );
    return changed.length;
  });
}
