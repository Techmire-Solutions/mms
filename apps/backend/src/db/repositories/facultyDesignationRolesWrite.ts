/**
 * @file facultyDesignationRolesWrite.ts
 * @description Replace assignable role keys for a faculty designation.
 */
import { and, eq } from "drizzle-orm";
import { facultyDesignationRoles } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/** Normalize, dedupe, and replace all role keys for one designation (at most one). */
export async function replaceFacultyDesignationRoles(
  tx: TenantTransaction,
  workspaceSubdomain: string,
  designationId: string,
  roleKeys: readonly string[] | undefined,
): Promise<string[]> {
  const unique = [
    ...new Set((roleKeys ?? []).map((key) => key.trim()).filter((key) => key.length > 0)),
  ].slice(0, 1);
  await tx
    .delete(facultyDesignationRoles)
    .where(
      and(
        eq(facultyDesignationRoles.workspaceSubdomain, workspaceSubdomain),
        eq(facultyDesignationRoles.designationId, designationId),
      ),
    );
  if (unique.length === 0) return [];
  await tx
    .insert(facultyDesignationRoles)
    .values(unique.map((roleKey) => ({ workspaceSubdomain, designationId, roleKey })));
  return unique;
}
