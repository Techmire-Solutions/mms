import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { FacultyDesignationAssignment } from "@mms/shared";
import { facultyAssignments, facultyDesignations } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { listFacultyDesignations } from "./facultyDesignationRepository.js";

function iso(value: Date): string {
  return value.toISOString();
}

/** Projection columns: faculty_assignments → FacultyDesignationAssignment DTO. */
const FA_PROJECTION_COLUMNS = {
  id: facultyAssignments.id,
  facultyId: facultyAssignments.facultyId,
  designationId: facultyAssignments.designationId,
  designationName: facultyDesignations.name,
  hierarchyRank: facultyDesignations.hierarchyRank,
  isPrimary: facultyAssignments.isPrimary,
  status: facultyAssignments.status,
  startsOn: facultyAssignments.startDate,
  endsOn: facultyAssignments.endDate,
  notes: facultyAssignments.notes,
  createdAt: facultyAssignments.createdAt,
  updatedAt: facultyAssignments.updatedAt,
};

interface RawAssignmentRow {
  id: string;
  facultyId: string;
  designationId: string;
  designationName: string;
  hierarchyRank: number;
  isPrimary: boolean;
  status: string;
  startsOn: string;
  endsOn: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapAssignmentRow(
  row: RawAssignmentRow,
  rolesByDesignation: Map<string, string[]>,
): FacultyDesignationAssignment {
  return {
    id: row.id,
    facultyId: row.facultyId,
    designationId: row.designationId,
    designationName: row.designationName,
    hierarchyRank: row.hierarchyRank,
    endsOn: row.endsOn ?? null,
    notes: row.notes ?? null,
    assignableRoles: rolesByDesignation.get(row.designationId) ?? [],
    startsOn: row.startsOn,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Lists appointment history as a designation-history projection of faculty_assignments. */
export async function listFacultyDesignationAssignments(
  tenant: string,
  facultyId: string,
): Promise<FacultyDesignationAssignment[]> {
  const workspaceSubdomain = tenant.trim().toLowerCase();
  return withTenantRead(workspaceSubdomain, async (tx) => {
    const rows = await tx
      .select(FA_PROJECTION_COLUMNS)
      .from(facultyAssignments)
      .innerJoin(
        facultyDesignations,
        and(
          eq(facultyDesignations.workspaceSubdomain, facultyAssignments.workspaceSubdomain),
          eq(facultyDesignations.id, facultyAssignments.designationId),
        ),
      )
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, workspaceSubdomain),
          eq(facultyAssignments.facultyId, facultyId),
          isNull(facultyAssignments.deletedAt),
        ),
      )
      .orderBy(desc(facultyAssignments.startDate));
    const definitions = await listFacultyDesignations(workspaceSubdomain, { limit: null });
    const rolesByDesignation = new Map(definitions.map((d) => [d.id, d.assignableRoles]));
    return rows.map((row) => mapAssignmentRow(row, rolesByDesignation));
  });
}

/** Returns the primary appointment effective on a given date (FA SSOT). */
export async function findCurrentFacultyDesignationAssignment(
  tenant: string,
  facultyId: string,
  onDate = new Date().toISOString().slice(0, 10),
): Promise<FacultyDesignationAssignment | null> {
  const workspaceSubdomain = tenant.trim().toLowerCase();
  return withTenantRead(workspaceSubdomain, async (tx) => {
    const rows = await tx
      .select(FA_PROJECTION_COLUMNS)
      .from(facultyAssignments)
      .innerJoin(
        facultyDesignations,
        and(
          eq(facultyDesignations.workspaceSubdomain, facultyAssignments.workspaceSubdomain),
          eq(facultyDesignations.id, facultyAssignments.designationId),
        ),
      )
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, workspaceSubdomain),
          eq(facultyAssignments.facultyId, facultyId),
          eq(facultyAssignments.isPrimary, true),
          eq(facultyAssignments.status, "active"),
          isNull(facultyAssignments.deletedAt),
          lte(facultyAssignments.startDate, onDate),
          or(isNull(facultyAssignments.endDate), gte(facultyAssignments.endDate, onDate)),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    const definitions = await listFacultyDesignations(workspaceSubdomain, { limit: null });
    const rolesByDesignation = new Map(definitions.map((d) => [d.id, d.assignableRoles]));
    return mapAssignmentRow(rows[0], rolesByDesignation);
  });
}
