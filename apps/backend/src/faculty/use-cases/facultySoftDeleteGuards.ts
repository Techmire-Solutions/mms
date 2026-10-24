/**
 * @file facultySoftDeleteGuards.ts
 * @description Subordinate reassignment guards before faculty soft-delete.
 */
import { ConflictError } from "../../lib/httpErrors.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";

export class SubordinateReassignmentError extends ConflictError {
  constructor(
    message = "Cannot delete faculty member with active subordinates. Please reassign subordinates before deletion.",
  ) {
    super(message);
    this.name = "SubordinateReassignmentError";
  }
}

export async function guardSubordinatesOnDelete(
  tenant: string,
  id: string,
  reassignSubordinatesTo: string | undefined,
  repo: FacultyRepository,
): Promise<void> {
  const subordinateCount = repo.countSubordinates ? await repo.countSubordinates(tenant, id) : 0;
  if (subordinateCount === 0) return;

  if (reassignSubordinatesTo && reassignSubordinatesTo.trim()) {
    const targetId = reassignSubordinatesTo.trim();
    if (targetId === id) {
      throw new ConflictError("Cannot reassign subordinates to the faculty member being deleted");
    }
    const targetSupervisor = await repo.findById(tenant, targetId);
    if (!targetSupervisor || targetSupervisor.deletedAt) {
      throw new ConflictError(
        "Target supervisor for reassignment does not exist or has been deleted",
      );
    }
    await repo.reassignSubordinates(tenant, id, targetId);
  } else {
    throw new SubordinateReassignmentError(
      `Cannot delete faculty member with ${subordinateCount} active subordinate(s). Please reassign subordinates before deletion.`,
    );
  }
}

/** Bulk delete: ensure no active subordinates remain outside the deleted set. */
export async function guardBulkSubordinatesOnDelete(
  tenant: string,
  uniqueIds: string[],
  repo: FacultyRepository,
): Promise<void> {
  if (!repo.countSubordinatesBatch) return;
  const subCounts = await repo.countSubordinatesBatch(tenant, uniqueIds);
  const getCount = (id: string): number => {
    if (!subCounts) return 0;
    if (subCounts instanceof Map) return subCounts.get(id) ?? 0;
    return (subCounts as Record<string, number>)[id] ?? 0;
  };
  const supervisorIdsWithSubs = uniqueIds.filter((id) => getCount(id) > 0);
  if (supervisorIdsWithSubs.length === 0) return;
  const deletedIdSet = new Set(uniqueIds);
  for (const supId of supervisorIdsWithSubs) {
    const subs = repo.findSubordinates ? await repo.findSubordinates(tenant, supId) : [];
    const activeOrphaned = subs.filter(
      (sub) => !sub.deletedAt && !deletedIdSet.has(String(sub.id)),
    );
    if (activeOrphaned.length > 0) {
      throw new SubordinateReassignmentError(
        `Cannot delete faculty member (${supId}) with ${activeOrphaned.length} active subordinate(s). Please reassign subordinates before deletion.`,
      );
    }
  }
}
