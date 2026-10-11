import { sql } from "drizzle-orm";
import { slugifyFacultyCatalogCode } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";

/** Raised when a catalog write collides with an existing live row (maps to HTTP 409). */
export class FacultyCatalogConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacultyCatalogConflictError";
  }
}

type Executor = Pick<TenantTransaction, "execute">;

/**
 * Faculty Management model: a department is identified by its name, which must
 * be unique per workspace (case-insensitive) among live rows. Archived rows
 * cannot be overwritten through save — they must be restored first.
 */
export async function validateFacultyDepartment(
  tx: Executor,
  tenant: string,
  input: { id: string; name: string },
): Promise<void> {
  await lockFacultyHierarchy(tx, tenant);
  if (!input.name.trim()) throw new Error("Department name is required");
  const existing = await tx.execute<{ deleted_at: Date | null }>(sql`
    SELECT deleted_at FROM faculty_departments WHERE workspace_subdomain = ${tenant}
      AND id = ${input.id} FOR UPDATE
  `);
  if (existing.rows.some((row) => row.deleted_at !== null))
    throw new Error("Department is archived");
  const duplicate = await tx.execute<{ id: string }>(sql`
    SELECT id FROM faculty_departments
    WHERE workspace_subdomain = ${tenant}
      AND id <> ${input.id}
      AND deleted_at IS NULL
      AND lower(btrim(name)) = lower(btrim(${input.name}))
    LIMIT 1
  `);
  if (duplicate.rows.length) {
    throw new FacultyCatalogConflictError("A department with this name already exists");
  }
}

const CATALOG_CODE_LENGTH = { faculty_departments: 32, faculty_designations: 50 } as const;

/**
 * Legacy `code` is server-derived: existing rows keep their code (imports and
 * blueprints key on it); new rows get a slug of the name, suffixed on collision.
 */
export async function resolveFacultyCatalogCode(
  tx: Executor,
  table: keyof typeof CATALOG_CODE_LENGTH,
  tenant: string,
  id: string,
  name: string,
): Promise<string> {
  const maxLength = CATALOG_CODE_LENGTH[table];
  const relation = sql.identifier(table);
  const current = await tx.execute<{ code: string | null }>(sql`
    SELECT code FROM ${relation} WHERE workspace_subdomain = ${tenant} AND id = ${id} LIMIT 1
  `);
  const existingCode = current.rows[0]?.code?.trim();
  if (existingCode) return existingCode;
  const base =
    slugifyFacultyCatalogCode(name, maxLength) || table.replace("faculty_", "").slice(0, 4);
  const taken = await tx.execute<{ code: string }>(sql`
    SELECT code FROM ${relation}
    WHERE workspace_subdomain = ${tenant} AND deleted_at IS NULL AND id <> ${id} AND code = ${base}
    LIMIT 1
  `);
  if (!taken.rows.length) return base;
  const suffix =
    id
      .replace(/[^a-z0-9]/gi, "")
      .slice(-6)
      .toLowerCase() || Date.now().toString(36);
  return `${base.slice(0, maxLength - suffix.length - 1)}-${suffix}`;
}

/** A department cannot be archived while live designations or assignments reference it. */
export async function validateDepartmentDeletion(tx: Executor, tenant: string, id: string) {
  await lockFacultyHierarchy(tx, tenant);
  const dependents = await tx.execute(sql`
    SELECT id FROM faculty_designations WHERE workspace_subdomain = ${tenant}
      AND department_id = ${id} AND deleted_at IS NULL
    UNION ALL
    SELECT id FROM faculty_assignments WHERE workspace_subdomain = ${tenant}
      AND department_id = ${id} AND deleted_at IS NULL LIMIT 1
  `);
  if (dependents.rows.length) {
    throw new FacultyCatalogConflictError("Department has active designations or assignments");
  }
}
