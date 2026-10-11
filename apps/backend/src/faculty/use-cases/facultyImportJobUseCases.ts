import { randomUUID } from "node:crypto";
import type { FacultyImportJobPayload } from "@mms/shared";
import { listFacultyDepartments } from "../../db/repositories/facultyDepartmentRepository.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import {
  createFaculty,
  loadFacultyPage,
  updateFacultyById,
} from "../../services/facultyService.js";

export interface FacultyImportJobContext {
  tenant: string;
  userId: string;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface FacultyImportJobResult {
  imported: number;
  failed: number;
  total: number;
}

/** Upsert faculty by employeeId; create requires contactId. */
export async function runFacultyMembersImportJob(
  payload: FacultyImportJobPayload,
  context: FacultyImportJobContext,
): Promise<FacultyImportJobResult> {
  const rows = payload.rows ?? [];
  const total = rows.length;
  let imported = 0;
  await context.updateProgress(0, total);

  const departments = await listFacultyDepartments(context.tenant, { limit: null });
  const designations = await listFacultyDesignations(context.tenant, { limit: null });
  const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  const deptByKey = new Map<string, (typeof departments)[number]>();
  for (const d of departments) {
    deptByKey.set(norm(d.name), d);
    if (d.code) deptByKey.set(norm(d.code), d);
  }
  const resolveDesignation = (raw: string, deptId: string | undefined) => {
    const key = norm(raw);
    const matches = designations.filter(
      (d) => norm(d.name) === key || (d.code != null && norm(d.code) === key),
    );
    return matches.find((d) => deptId && d.departmentId === deptId) ?? matches[0];
  };

  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    try {
      const dept = row.department ? deptByKey.get(norm(row.department)) : undefined;
      const desig = row.designation ? resolveDesignation(row.designation, dept?.id) : undefined;

      let existingId: string | undefined;
      if (row.employeeId?.trim()) {
        const page = await loadFacultyPage({
          search: row.employeeId.trim(),
          limit: 20,
          page: 1,
        });
        const match = (page.faculty ?? []).find(
          (f) =>
            String(f.employeeId ?? "")
              .trim()
              .toLowerCase() === row.employeeId!.trim().toLowerCase(),
        );
        if (match?.id) existingId = String(match.id);
      }

      const patch: Record<string, unknown> = {};
      if (row.employeeId) patch.employeeId = row.employeeId.trim();
      if (row.specialization) patch.specialization = row.specialization;
      if (desig) patch.designationId = desig.id;
      if (row.status) patch.status = row.status;
      if (row.qualification) patch.qualification = row.qualification;
      const employmentStartDate = row.employmentStartDate ?? row.joinDate;
      if (employmentStartDate) patch.employmentStartDate = employmentStartDate;
      if (row.employmentEndDate) patch.employmentEndDate = row.employmentEndDate;

      if (existingId) {
        await updateFacultyById(existingId, patch);
      } else {
        const contactId = row.contactId?.trim();
        if (!contactId) throw new Error("contactId required to create faculty");
        await createFaculty({
          id: randomUUID(),
          contactId,
          ...patch,
        });
      }
      imported += 1;
    } catch {
      // Continue batch
    }
    if ((i + 1) % 10 === 0 || i + 1 === total) {
      await context.updateProgress(i + 1, total);
    }
  }

  return { imported, failed: total - imported, total };
}

export function buildFacultyImportJobLabel(result: FacultyImportJobResult): string {
  if (result.failed > 0) {
    return `Imported ${result.imported}/${result.total} faculty (${result.failed} failed)`;
  }
  return `Imported ${result.imported} faculty`;
}
