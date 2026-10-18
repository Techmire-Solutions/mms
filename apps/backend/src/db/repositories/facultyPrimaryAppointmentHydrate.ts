import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FacultyMember } from "@mms/shared";
import { facultyDepartments, facultyDesignations } from "../schema.js";
import type { AppDb } from "../tenant-context.js";

const parentDesignations = alias(facultyDesignations, "parent_designation");

/**
 * Attaches department / designation display fields from `faculty.designation_id`
 * (Faculty Management model). Department is derived through the designation.
 */
export async function attachPrimaryAppointmentFields(
  tx: AppDb,
  subdomain: string,
  rows: FacultyMember[],
): Promise<FacultyMember[]> {
  const designationIds = [
    ...new Set(
      rows
        .map((row) => row.designationId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (designationIds.length === 0) return rows;
  const designationRows = await tx
    .select({
      id: facultyDesignations.id,
      name: facultyDesignations.name,
      departmentId: facultyDesignations.departmentId,
      departmentName: facultyDepartments.name,
      parentDesignationId: facultyDesignations.parentDesignationId,
      parentDesignationName: parentDesignations.name,
      hierarchyRank: facultyDesignations.hierarchyRank,
    })
    .from(facultyDesignations)
    .leftJoin(
      facultyDepartments,
      and(
        eq(facultyDepartments.workspaceSubdomain, facultyDesignations.workspaceSubdomain),
        eq(facultyDepartments.id, facultyDesignations.departmentId),
      ),
    )
    .leftJoin(
      parentDesignations,
      and(
        eq(parentDesignations.workspaceSubdomain, facultyDesignations.workspaceSubdomain),
        eq(parentDesignations.id, facultyDesignations.parentDesignationId),
      ),
    )
    .where(
      and(
        eq(facultyDesignations.workspaceSubdomain, subdomain),
        inArray(facultyDesignations.id, designationIds),
      ),
    );

  const byId = new Map(designationRows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const designation = row.designationId ? byId.get(row.designationId) : undefined;
    if (!designation) return row;
    return {
      ...row,
      designation: designation.name,
      departmentId: designation.departmentId ?? undefined,
      department: designation.departmentName ?? undefined,
      parentDesignationId: designation.parentDesignationId,
      hierarchyRank: designation.hierarchyRank,
    };
  });
}
