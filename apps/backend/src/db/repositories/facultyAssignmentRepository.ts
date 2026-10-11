import { facultyAssignmentSchema } from "@mms/shared";
import { and, eq, isNull, gte, lte, or } from "drizzle-orm";
import { facultyAssignments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import type { FacultyAssignmentRow } from "../schema/facultyAssignmentTables.js";

export {
  type AssignmentTreeNode,
  findAssignmentManagerChain,
  findFacultyManagerChain,
  findAssignmentSubordinateTree,
  checkAssignmentCycleSafe,
} from "./facultyAssignmentHierarchyRepository.js";

const FACULTY_ASSIGNMENT_COLUMNS = {
  id: facultyAssignments.id,
  workspaceSubdomain: facultyAssignments.workspaceSubdomain,
  facultyId: facultyAssignments.facultyId,
  departmentId: facultyAssignments.departmentId,
  designationId: facultyAssignments.designationId,
  isPrimary: facultyAssignments.isPrimary,
  status: facultyAssignments.status,
  startDate: facultyAssignments.startDate,
  endDate: facultyAssignments.endDate,
  notes: facultyAssignments.notes,
  deletedAt: facultyAssignments.deletedAt,
  deletedBy: facultyAssignments.deletedBy,
  deletionReason: facultyAssignments.deletionReason,
  restoredAt: facultyAssignments.restoredAt,
  restoredBy: facultyAssignments.restoredBy,
  deletedWithCascade: facultyAssignments.deletedWithCascade,
  createdAt: facultyAssignments.createdAt,
  updatedAt: facultyAssignments.updatedAt,
  createdBy: facultyAssignments.createdBy,
  updatedBy: facultyAssignments.updatedBy,
};

/* ── Read helpers ─────────────────────────────────────────────────────────── */

export async function findFacultyAssignmentById(
  tenant: string,
  id: string,
): Promise<FacultyAssignmentRow | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_ASSIGNMENT_COLUMNS)
      .from(facultyAssignments)
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.id, id),
          isNull(facultyAssignments.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listFacultyAssignments(
  tenant: string,
  facultyId: string,
  options: { activeOnly?: boolean } = { activeOnly: true },
): Promise<FacultyAssignmentRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const where = options.activeOnly
      ? and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.facultyId, facultyId),
          isNull(facultyAssignments.deletedAt),
        )
      : and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.facultyId, facultyId),
        );
    return tx
      .select(FACULTY_ASSIGNMENT_COLUMNS)
      .from(facultyAssignments)
      .where(where)
      .orderBy(facultyAssignments.startDate);
  });
}

export async function findPrimaryFacultyAssignment(
  tenant: string,
  facultyId: string,
  onDate: string,
): Promise<FacultyAssignmentRow | null> {
  facultyAssignmentSchema.shape.startDate.parse(onDate);
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_ASSIGNMENT_COLUMNS)
      .from(facultyAssignments)
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.facultyId, facultyId),
          eq(facultyAssignments.isPrimary, true),
          isNull(facultyAssignments.deletedAt),
          lte(facultyAssignments.startDate, onDate),
          or(isNull(facultyAssignments.endDate), gte(facultyAssignments.endDate, onDate)),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export {
  saveFacultyAssignment,
  closeAssignment,
  softDeleteFacultyAssignment,
} from "./facultyAssignmentWriteRepository.js";
