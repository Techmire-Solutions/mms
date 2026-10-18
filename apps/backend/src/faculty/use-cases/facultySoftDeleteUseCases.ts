/**
 * @file facultySoftDeleteUseCases.ts
 * @description Soft-delete faculty members (single + bulk) with subordinate guards.
 */
import { dedupeTrimmedIds, type Faculty } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";
import { nowIso } from "../../lib/softDeleteHelpers.js";
import { restoreFacultyById, bulkRestoreFaculty } from "./facultyRestoreUseCases.js";
import { cascadeFacultySoftDeleteSideEffects } from "./facultySoftDeleteCascade.js";
import {
  guardBulkSubordinatesOnDelete,
  guardSubordinatesOnDelete,
  SubordinateReassignmentError,
} from "./facultySoftDeleteGuards.js";

export { restoreFacultyById, bulkRestoreFaculty };
export { SubordinateReassignmentError };

export async function softDeleteFacultyById(
  id: string,
  deletedBy: string,
  deletionReason?: string,
  repo: FacultyRepository = facultyRepository,
  reassignSubordinatesTo?: string,
): Promise<boolean> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: 1 };

    await repo.guardAssignmentDependents(tenant, [id]);
    await guardSubordinatesOnDelete(tenant, id, reassignSubordinatesTo, repo);

    const now = nowIso();
    const trimmedReason = deletionReason?.trim();
    const existingFaculty = await repo.findByIds(tenant, [id]);
    const existing = existingFaculty[0];
    const toSave: Faculty[] = [];
    if (existing && !existing.deletedAt) {
      toSave.push({
        ...existing,
        deletedAt: now,
        deletedBy,
        deletionReason: trimmedReason || undefined,
      });
    }

    if (toSave.length === 0) return { succeeded: 0, failed: 1 };
    await repo.bulkSave(tenant, toSave);
    await cascadeFacultySoftDeleteSideEffects(tenant, toSave, deletedBy, trimmedReason, now);
    return { succeeded: 1, failed: 0 };
  });

  if (result.succeeded > 0) await broadcastCollection("faculty");
  return result.succeeded === 1;
}

export async function bulkSoftDeleteFaculty(
  ids: string[],
  deletedBy: string,
  deletionReason?: string,
  repo: FacultyRepository = facultyRepository,
): Promise<{ succeeded: number; failed: number }> {
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const tenant = getRequestTenant();

  const result = await runInTransaction(async () => {
    if (!tenant) return { succeeded: 0, failed: uniqueIds.length };

    await repo.guardAssignmentDependents(tenant, uniqueIds);
    await guardBulkSubordinatesOnDelete(tenant, uniqueIds, repo);

    let succeeded = 0;
    let failed = 0;
    const now = nowIso();
    const trimmedReason = deletionReason?.trim();
    const toSave: Faculty[] = [];
    const existingFaculty = await repo.findByIds(tenant, uniqueIds);
    const existingMap = new Map(existingFaculty.map((f) => [String(f.id), f]));

    for (const id of uniqueIds) {
      const existing = existingMap.get(id);
      if (existing && !existing.deletedAt) {
        toSave.push({
          ...existing,
          deletedAt: now,
          deletedBy,
          deletionReason: trimmedReason || undefined,
        });
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    if (toSave.length > 0) {
      await repo.bulkSave(tenant, toSave);
      await cascadeFacultySoftDeleteSideEffects(tenant, toSave, deletedBy, trimmedReason, now);
    }
    return { succeeded, failed };
  });

  if (result.succeeded > 0) await broadcastCollection("faculty");
  return result;
}
