import { z } from "zod";
import { FACULTY_CATALOG_STATUS_VALUES } from "./facultyTypes.js";

// ── Faculty Department Entity ─────────────────────────────────────────────────

export const FACULTY_DEPARTMENT_NAME_MAX = 255;
export const FACULTY_DEPARTMENT_DESCRIPTION_MAX = 2000;

/**
 * Read-model for a `faculty_departments` row.
 * Returned by GET /api/faculty/departments and list endpoints.
 * `name` is unique per workspace among active rows (case-insensitive).
 */
export const facultyDepartmentSchema = z.object({
  id: z.string().min(1).max(100),
  workspaceSubdomain: z.string().min(1).max(63).optional(),
  name: z.string().trim().min(1).max(FACULTY_DEPARTMENT_NAME_MAX),
  description: z.string().trim().max(FACULTY_DEPARTMENT_DESCRIPTION_MAX).nullable().optional(),
  status: z.enum(FACULTY_CATALOG_STATUS_VALUES).default("active"),
  /** @deprecated Derived from `status`; retained for legacy readers until the contract migration. */
  isActive: z.boolean().optional(),
  /** @deprecated Server-derived slug kept for CSV/blueprint compatibility; not user-editable. */
  code: z.string().trim().max(32).nullable().optional(),
  /** Count of active designations in this department; hydrated server-side on list endpoints. */
  designationCount: z.number().int().min(0).optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Write payload when creating or updating a department. */
export const facultyDepartmentWriteSchema = facultyDepartmentSchema
  .pick({ name: true, description: true, status: true })
  .extend({
    id: z.string().min(1).max(100).optional(), // optional on create
    status: z.enum(FACULTY_CATALOG_STATUS_VALUES).optional().default("active"),
  })
  .strict();

/** Case-insensitive duplicate-name check against sibling departments (client preflight; server is authoritative). */
export function isDuplicateFacultyDepartmentName(
  departments: ReadonlyArray<{ id: string; name: string; deletedAt?: string | null }>,
  name: string,
  excludeId?: string | null,
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return departments.some(
    (department) =>
      department.id !== excludeId &&
      !department.deletedAt &&
      department.name.trim().toLowerCase() === needle,
  );
}

/**
 * Derives the legacy `code` slug from a catalog name (departments / designations).
 * Server-owned: the user never edits codes under the Faculty Management model.
 */
export function slugifyFacultyCatalogCode(name: string, maxLength = 32): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}

export type FacultyDepartmentEntity = z.infer<typeof facultyDepartmentSchema>;
export type FacultyDepartmentWrite = z.infer<typeof facultyDepartmentWriteSchema>;

/**
 * Active catalog row (department or designation). Prefers `status`; falls back to
 * legacy `isActive` for expand-phase readers that have not been remapped yet.
 */
export function isFacultyCatalogRowActive(row: {
  status?: string | null;
  isActive?: boolean;
  deletedAt?: string | null;
}): boolean {
  if (row.deletedAt) return false;
  if (row.status) return row.status === "active";
  return row.isActive !== false;
}

// ── Faculty Assignment Entity ─────────────────────────────────────────────────

const isoDate = z.iso.date();

/**
 * Read-model for a `faculty_assignments` row.
 * Returned by GET /api/faculty/:id/assignments.
 */
export const FACULTY_ASSIGNMENT_STATUSES = ["active", "inactive"] as const;
export type FacultyAssignmentStatus = (typeof FACULTY_ASSIGNMENT_STATUSES)[number];

export const facultyAssignmentSchema = z
  .object({
    id: z.string().min(1).max(100),
    facultyId: z.string().min(1).max(100),
    departmentId: z.string().min(1).max(100),
    designationId: z.string().min(1).max(100),
    isPrimary: z.boolean().default(false),
    status: z.enum(FACULTY_ASSIGNMENT_STATUSES).default("active"),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    /** Hydrated from linked department row — for display only. */
    departmentName: z.string().optional(),
    /** Hydrated from linked designation row — for display only. */
    designationName: z.string().optional(),
    designationHierarchyRank: z.number().int().min(1).max(99).optional(),
    deletedAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

/** Write payload for creating or updating an assignment. */
export const facultyAssignmentWriteSchema = facultyAssignmentSchema
  .omit({
    departmentName: true,
    designationName: true,
    designationHierarchyRank: true,
    deletedAt: true,
    createdAt: true,
    updatedAt: true,
    status: true,
  })
  .extend({
    id: z.string().min(1).max(100).optional(),
    status: z.enum(FACULTY_ASSIGNMENT_STATUSES).optional().default("active"),
  })
  .refine((a) => !a.endDate || a.endDate >= a.startDate, {
    path: ["endDate"],
    message: "End date must not precede start date",
  });

export type FacultyAssignmentEntity = z.infer<typeof facultyAssignmentSchema>;
export type FacultyAssignmentWrite = z.infer<typeof facultyAssignmentWriteSchema>;

export const facultyAssignmentTreeNodeSchema = facultyAssignmentSchema
  .pick({
    id: true,
    facultyId: true,
    departmentId: true,
    designationId: true,
    isPrimary: true,
    startDate: true,
    endDate: true,
  })
  .extend({
    /** Display name of the faculty member on this assignment (hydrated). */
    facultyName: z.string().optional(),
    endDate: z.iso.date().nullable(),
    depth: z.number().int().min(1).max(20),
    path: z.array(z.string()).min(2).max(21),
    isCycle: z.boolean(),
  })
  .strict();

export type FacultyAssignmentTreeNode = z.infer<typeof facultyAssignmentTreeNodeSchema>;
