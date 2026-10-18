import { randomUUID } from "node:crypto";
import type { FacultyDepartmentImportBody, FacultyDesignationImportBody } from "@mms/shared";
import {
  listFacultyDepartments,
  saveFacultyDepartment,
} from "../../db/repositories/facultyDepartmentRepository.js";
import {
  listFacultyDesignations,
  saveFacultyDesignation,
} from "../../db/repositories/facultyDesignationRepository.js";

export interface CatalogImportJobContext {
  tenant: string;
  userId: string;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface CatalogImportJobResult {
  imported: number;
  failed: number;
  total: number;
}

const norm = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

async function reportProgress(
  context: CatalogImportJobContext,
  index: number,
  total: number,
): Promise<void> {
  if ((index + 1) % 10 === 0 || index + 1 === total) {
    await context.updateProgress(index + 1, total);
  }
}

/** Upsert departments by name (case-insensitive). */
export async function runFacultyDepartmentsImportJob(
  payload: { rows: FacultyDepartmentImportBody["rows"] },
  context: CatalogImportJobContext,
): Promise<CatalogImportJobResult> {
  const rows = payload.rows ?? [];
  const total = rows.length;
  let imported = 0;
  await context.updateProgress(0, total);

  const existing = await listFacultyDepartments(context.tenant, { limit: null });
  const idByName = new Map(existing.map((d) => [norm(d.name), d.id]));

  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    try {
      const key = norm(row.name);
      const id = idByName.get(key) ?? randomUUID();
      await saveFacultyDepartment(context.tenant, {
        id,
        name: row.name,
        description: row.description ?? null,
        status: row.status ?? "active",
        updatedBy: context.userId,
      });
      idByName.set(key, id);
      imported += 1;
    } catch {
      // Continue batch
    }
    await reportProgress(context, i, total);
  }

  return { imported, failed: total - imported, total };
}

/**
 * Upsert designations by (department name, designation name). Parents are linked
 * in a second pass so forward references inside the same file resolve.
 */
export async function runFacultyDesignationsImportJob(
  payload: { rows: FacultyDesignationImportBody["rows"] },
  context: CatalogImportJobContext,
): Promise<CatalogImportJobResult> {
  const rows = payload.rows ?? [];
  const total = rows.length;
  let imported = 0;
  await context.updateProgress(0, total);

  const departments = await listFacultyDepartments(context.tenant, { limit: null });
  const deptIdByName = new Map(departments.map((d) => [norm(d.name), d.id]));
  const existing = await listFacultyDesignations(context.tenant, { limit: null });
  const keyOf = (departmentId: string, name: string) => `${departmentId}::${norm(name)}`;
  const idByKey = new Map(existing.map((d) => [keyOf(d.departmentId, d.name), d.id]));
  const parentIdByKey = new Map(
    existing.map((d) => [keyOf(d.departmentId, d.name), d.parentDesignationId ?? null]),
  );

  // First pass: upsert rows without parents (keeps existing parent when already linked).
  const saved: Array<{ id: string; departmentId: string; row: (typeof rows)[number] }> = [];
  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    try {
      const departmentId = deptIdByName.get(norm(row.department));
      if (!departmentId) throw new Error(`Unknown department "${row.department}"`);
      const key = keyOf(departmentId, row.name);
      const id = idByKey.get(key) ?? randomUUID();
      await saveFacultyDesignation(context.tenant, {
        id,
        departmentId,
        name: row.name,
        parentDesignationId: parentIdByKey.get(key) ?? null,
        status: row.status ?? "active",
        updatedBy: context.userId,
      });
      idByKey.set(key, id);
      saved.push({ id, departmentId, row });
      imported += 1;
    } catch {
      // Continue batch
    }
    await reportProgress(context, i, total);
  }

  // Second pass: resolve parent designation names (same department first, then any department).
  for (const entry of saved) {
    const parentName = entry.row.parentDesignation?.trim();
    if (!parentName) continue;
    const parentId =
      idByKey.get(keyOf(entry.departmentId, parentName)) ??
      [...idByKey.entries()].find(([key]) => key.endsWith(`::${norm(parentName)}`))?.[1];
    if (!parentId || parentId === entry.id) continue;
    try {
      await saveFacultyDesignation(context.tenant, {
        id: entry.id,
        departmentId: entry.departmentId,
        name: entry.row.name,
        parentDesignationId: parentId,
        status: entry.row.status ?? "active",
        updatedBy: context.userId,
      });
    } catch {
      // ignore parent-link failures (cycle / depth guards)
    }
  }

  return { imported, failed: total - imported, total };
}

export function buildCatalogImportJobLabel(entity: string, result: CatalogImportJobResult): string {
  if (result.failed > 0) {
    return `Imported ${result.imported}/${result.total} ${entity} (${result.failed} failed)`;
  }
  return `Imported ${result.imported} ${entity}`;
}
