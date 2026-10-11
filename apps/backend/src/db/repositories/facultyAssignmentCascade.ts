import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { facultyAssignments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";

/**
 * Soft-delete live appointments when faculty is archived.
 * Marks deletedWithCascade so restore can reverse only cascaded rows.
 */
export async function cascadeSoftDeleteFacultyAssignments(
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
    await lockFacultyHierarchy(tx, subdomain);
    const changed = await tx
      .update(facultyAssignments)
      .set({
        deletedAt: now,
        deletedBy,
        deletionReason: reason,
        deletedWithCascade: true,
        updatedAt: now,
      })
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          inArray(facultyAssignments.facultyId, facultyIds),
          isNull(facultyAssignments.deletedAt),
        ),
      )
      .returning({ id: facultyAssignments.id });
    return changed.length;
  });
}

/** Restore appointments that were cascade-deleted with their parent faculty. */
export async function cascadeRestoreFacultyAssignments(
  tenant: string,
  facultyIds: string[],
  restoredBy?: string,
): Promise<number> {
  if (facultyIds.length === 0) return 0;
  const subdomain = tenant.trim().toLowerCase();
  const now = new Date();

  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const changed = await tx
      .update(facultyAssignments)
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
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          inArray(facultyAssignments.facultyId, facultyIds),
          isNotNull(facultyAssignments.deletedAt),
          eq(facultyAssignments.deletedWithCascade, true),
        ),
      )
      .returning({ id: facultyAssignments.id });
    return changed.length;
  });
}
