import type { FacultyImportJobPayload } from "@mms/shared";
import { listFacultyDepartments } from "../../db/repositories/facultyDepartmentRepository.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import {
  createFaculty,
  findFacultyIdsByEmployeeIds,
  updateFacultyById,
} from "../../services/facultyService.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { tenantUserHasPermission } from "../../lib/tenantRoleCatalog.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import type { FacultyBatchSideEffects } from "./facultyWriteUseCases.js";

/** Cap recorded row errors so a fully-invalid file cannot grow the job payload. */
const MAX_RECORDED_FAILURES = 5;

export interface FacultyImportJobContext {
  tenant: string;
  userId: string;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface FacultyImportJobResult {
  imported: number;
  failed: number;
  total: number;
  /** First few per-row failure messages (diagnostics; never the whole file). */
  failures: string[];
}

/**
 * Upsert faculty by employeeId; create requires contactId.
 *
 * Batch-writer contract: writes go through the single-record use cases with a
 * deferred side-effect collector, so contact tag reconciliation and the live
 * push broadcast run once after the loop instead of once per row.
 */
export async function runFacultyMembersImportJob(
  payload: FacultyImportJobPayload,
  context: FacultyImportJobContext,
): Promise<FacultyImportJobResult> {
  const rows = payload.rows ?? [];
  const total = rows.length;
  let imported = 0;
  const failures: string[] = [];
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

  // One lookup for every employee id in the file instead of one list query per row.
  const employeeIdById = await findFacultyIdsByEmployeeIds(
    rows.map((row) => row.employeeId ?? "").filter((value) => value.trim().length > 0),
  );
  const batch: FacultyBatchSideEffects = { contactIds: new Set<string>() };
  // The queued job runs outside the request guard: evaluate the acting user's
  // current role + tenant catalog so an import cannot resurrect an archived
  // profile without `faculty.delete`.
  const canRestore = await tenantUserHasPermission(
    context.tenant,
    context.userId,
    "faculty.delete",
  );

  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    try {
      const dept = row.department ? deptByKey.get(norm(row.department)) : undefined;
      const desig = row.designation ? resolveDesignation(row.designation, dept?.id) : undefined;

      const employeeIdKey = norm(row.employeeId);
      const existingId = employeeIdKey ? employeeIdById[employeeIdKey] : undefined;

      const patch: Record<string, unknown> = {};
      if (row.employeeId) patch.employeeId = row.employeeId.trim();
      if (row.specialization) patch.specialization = row.specialization;
      if (desig) patch.designationId = desig.id;
      if (row.status) patch.status = row.status;
      if (row.qualification) patch.qualification = row.qualification;
      const employmentStartDate = row.employmentStartDate ?? row.joinDate;
      if (employmentStartDate) patch.employmentStartDate = employmentStartDate;
      if (row.employmentEndDate) patch.employmentEndDate = row.employmentEndDate;

      let savedId: string | undefined;
      if (existingId) {
        const updated = await updateFacultyById(existingId, patch, { batch });
        savedId = updated ? String(updated.id) : undefined;
      } else {
        const contactId = row.contactId?.trim();
        if (!contactId) throw new Error("contactId required to create faculty");
        // The row resolver owns the id (`fac-<uuid>`); batch rows skip the stale-
        // preview probe, which exists for interactive forms only.
        const created = await createFaculty(
          { contactId, ...patch },
          { batch, canRestore, skipEmployeeIdPreview: true },
        );
        savedId = String(created.record.id);
      }
      // Keep the in-memory map warm so duplicate rows in one file update the same
      // record instead of racing the unique employee-id index.
      if (employeeIdKey && savedId) employeeIdById[employeeIdKey] = savedId;
      imported += 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (failures.length < MAX_RECORDED_FAILURES) failures.push(message);
      logger.warn(
        { err: error, tenant: context.tenant, row: i + 1, employeeId: row.employeeId },
        "Faculty import row failed; continuing batch",
      );
    }
    if ((i + 1) % 10 === 0 || i + 1 === total) {
      await context.updateProgress(i + 1, total);
    }
  }

  if (batch.contactIds.size > 0) {
    await reconcileContactSystemTags(context.tenant, [...batch.contactIds], {
      actorId: context.userId,
    });
  }
  if (imported > 0) {
    await broadcastCollection("faculty");
  }

  return { imported, failed: total - imported, total, failures };
}

export function buildFacultyImportJobLabel(result: FacultyImportJobResult): string {
  if (result.failed > 0) {
    return `Imported ${result.imported}/${result.total} faculty (${result.failed} failed)`;
  }
  return `Imported ${result.imported} faculty`;
}
