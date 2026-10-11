import { z } from "zod";
import { FACULTY_CATALOG_STATUS_VALUES } from "./facultyTypes.js";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const FACULTY_DESIGNATION_NAME_MAX = 150;
/** Maximum parent-chain depth accepted for designation hierarchies. */
export const FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH = 20;

/**
 * A tenant-defined designation inside a department (e.g. Senior Lecturer, Alim, Hafiz Teacher).
 * `parentDesignationId` is a self-reference forming the reporting hierarchy.
 */
export const facultyDesignationSchema = z
  .object({
    id: z.string().min(1).max(100),
    /** Empty only for legacy rows created before departments were mandatory; writes require it. */
    departmentId: z.string().max(100),
    name: z.string().trim().min(1).max(FACULTY_DESIGNATION_NAME_MAX),
    parentDesignationId: z.string().min(1).max(100).nullable().optional(),
    status: z.enum(FACULTY_CATALOG_STATUS_VALUES).default("active"),
    /** Hydrated from the owning department row — display only. */
    departmentName: z.string().max(255).optional(),
    /** Hydrated from the parent designation row — display only. */
    parentDesignationName: z.string().max(FACULTY_DESIGNATION_NAME_MAX).nullable().optional(),
    /** Server-derived depth in the parent chain (1 = top level); never user-editable. */
    hierarchyRank: z.coerce.number().int().min(1).max(99).optional(),
    /** @deprecated Derived from `status`; retained for legacy readers until the contract migration. */
    isActive: z.boolean().optional(),
    /** @deprecated Server-derived slug kept for CSV/blueprint compatibility; not user-editable. */
    code: z.string().trim().max(50).nullable().optional(),
    /** Single WorkspaceRole id allowed while this designation is current (0 or 1). */
    assignableRoles: z.array(z.string().trim().min(1).max(100)).max(1).default([]),
    deletedAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

/** Write payload for a designation definition. */
export const facultyDesignationWriteSchema = facultyDesignationSchema
  .pick({ id: true, name: true, parentDesignationId: true })
  .extend({
    departmentId: z.string().min(1).max(100),
    status: z.enum(FACULTY_CATALOG_STATUS_VALUES).optional().default("active"),
    /** Single WorkspaceRole id (0 or 1) for linked user accounts while this designation is current. */
    assignableRoles: z.array(z.string().trim().min(1).max(100)).max(1).optional(),
  })
  .strict()
  .refine((row) => row.parentDesignationId !== row.id, {
    path: ["parentDesignationId"],
    message: "A designation cannot be its own parent",
  });

const facultyDesignationAssignmentBaseSchema = z
  .object({
    id: z.string().min(1).max(100),
    facultyId: z.string().min(1).max(100),
    designationId: z.string().min(1).max(100),
    designationName: z.string().max(150).optional(),
    hierarchyRank: z.coerce.number().int().min(1).max(99).optional(),
    assignableRoles: z.array(z.string().max(100)).optional(),
    startsOn: z.string().regex(isoDate),
    endsOn: z.string().regex(isoDate).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

const validPeriod = (assignment: { startsOn: string; endsOn?: string | null }) =>
  !assignment.endsOn || assignment.endsOn >= assignment.startsOn;

/** A dated designation held by one Faculty member (history projection). Periods are inclusive. */
export const facultyDesignationAssignmentSchema = facultyDesignationAssignmentBaseSchema.refine(
  validPeriod,
  { path: ["endsOn"], message: "Designation end date must not precede its start date" },
);

/** Write payload for assigning a designation period to a Faculty member. */
export const facultyDesignationAssignmentWriteSchema = facultyDesignationAssignmentBaseSchema
  .omit({
    designationName: true,
    hierarchyRank: true,
    assignableRoles: true,
    createdAt: true,
    updatedAt: true,
  })
  .refine(validPeriod, {
    path: ["endsOn"],
    message: "Designation end date must not precede its start date",
  });

export type FacultyDesignationDefinition = z.infer<typeof facultyDesignationSchema>;
export type FacultyDesignationWrite = z.infer<typeof facultyDesignationWriteSchema>;
export type FacultyDesignationAssignment = z.infer<typeof facultyDesignationAssignmentSchema>;
export type FacultyDesignationAssignmentWrite = z.infer<
  typeof facultyDesignationAssignmentWriteSchema
>;

type DesignationHierarchyNode = Pick<FacultyDesignationDefinition, "id" | "parentDesignationId">;

/**
 * Ids of `rootId` and every designation below it in the parent chain.
 * Used to exclude self/descendants from the parent dropdown.
 */
export function collectDesignationDescendantIds(
  designations: ReadonlyArray<DesignationHierarchyNode>,
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, DesignationHierarchyNode[]>();
  for (const row of designations) {
    if (!row.parentDesignationId) continue;
    const siblings = childrenByParent.get(row.parentDesignationId) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parentDesignationId, siblings);
  }
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenByParent.get(current) ?? []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

/**
 * Depth of `designationId` in the parent chain (1 = top level).
 * Returns `null` when the chain is cyclic or exceeds {@link FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH}.
 */
export function resolveDesignationHierarchyRank(
  designations: ReadonlyArray<DesignationHierarchyNode>,
  designationId: string,
): number | null {
  const byId = new Map(designations.map((row) => [row.id, row]));
  const visited = new Set<string>();
  let rank = 1;
  let current = byId.get(designationId);
  while (current?.parentDesignationId) {
    if (visited.has(current.id) || rank >= FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH) return null;
    visited.add(current.id);
    current = byId.get(current.parentDesignationId);
    rank += 1;
  }
  return rank;
}

/** "Department · Designation" or "Department · Designation · Role" for FK dropdowns. */
export function formatDesignationOptionLabel(
  designation: Pick<FacultyDesignationDefinition, "name" | "departmentName">,
  roleLabel?: string | null,
): string {
  const base = designation.departmentName
    ? `${designation.departmentName} · ${designation.name}`
    : designation.name;
  const role = typeof roleLabel === "string" ? roleLabel.trim() : "";
  return role ? `${base} · ${role}` : base;
}
