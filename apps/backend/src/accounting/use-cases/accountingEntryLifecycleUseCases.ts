import type { JournalEntry } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { dedupeTrimmedIds } from "@mms/shared";
import type { AccountingRepository } from "../repository/accountingRepository.js";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";

type CrudService<T extends { id?: string | number }> = ReturnType<
  typeof createGenericRelationalService<T>
>;

/**
 * Trash/restore helpers for journal entries — split out of
 * `accountingEntryMutationUseCases.ts` to keep that module inside the length
 * ceiling. The mutation module re-exports them, so callers keep one import.
 */

export async function restoreJournalEntryByIdHelper(
  repo: AccountingRepository,
  entryCrud: CrudService<JournalEntry>,
  id: string,
  userId?: string,
): Promise<boolean> {
  const tenant = getRequestTenant();
  if (tenant && repo.findEntryById && repo.findEntryByRef) {
    const trashed = await repo.findEntryById(tenant, id);
    if (trashed?.ref?.trim()) {
      const conflicting = await repo.findEntryByRef(tenant, trashed.ref.trim(), {
        excludeId: id,
      });
      if (conflicting) {
        throw new ConflictError(
          `Cannot restore journal entry: reference "${trashed.ref}" is already used by an active entry`,
        );
      }
    }
  }
  return entryCrud.restoreById(id, userId);
}

export async function bulkSoftDeleteJournalEntriesHelper(
  repo: AccountingRepository,
  deleteEntryFn: (id: string, deletedBy: string, deletionReason?: string) => Promise<boolean>,
  ids: string[],
  deletedBy: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
  const tenant = getRequestTenant();
  if (repo.bulkSoftDeleteEntries && tenant) {
    const result = await repo.bulkSoftDeleteEntries(tenant, cleanIds, deletedBy, deletionReason);
    if (result.succeeded > 0) {
      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "accounting_entries");
    }
    return result;
  }
  let succeeded = 0;
  let failed = 0;
  for (const id of cleanIds) {
    try {
      const ok = await deleteEntryFn(id, deletedBy, deletionReason);
      if (ok) succeeded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { succeeded, failed };
}
