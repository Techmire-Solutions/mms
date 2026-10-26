import { randomUUID } from "node:crypto";
import type { AccountingRepository } from "../repository/accountingRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import {
  journalEntryListSchema,
  dedupeTrimmedIds,
  type JournalEntry,
  type FiscalYear,
} from "@mms/shared";
import { upsertWithBroadcast } from "../../services/tenantBulkService.js";
import { assignVoucherRefs } from "./journalVoucherRefs.js";
import {
  prepareJournalEntryForPersist,
  assertJournalEntryPeriodOpen,
  assertJournalAccountsWritable,
  assertEntriesMutable,
  assertEntriesWritable,
  loadStoredEntriesByIds,
  withServerOwnedSourceKeys,
  mapJournalEntryUniqueError,
  journalEntryContentChanged,
} from "./accountingLedgerGuards.js";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { resolveEntriesFx } from "./journalEntryFx.js";

type CrudService<T extends { id?: string | number }> = ReturnType<
  typeof createGenericRelationalService<T>
>;

export async function upsertEntriesHelper(
  repo: AccountingRepository,
  loadFiscalYears: () => Promise<FiscalYear[]>,
  entries: JournalEntry[],
): Promise<JournalEntry[]> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return withTenant(tenant, async () => {
    const parsed = journalEntryListSchema.parse(entries);
    await repo.lockJournalEntries(
      tenant,
      parsed.map((entry) => entry.id),
    );
    const fiscalYears = await loadFiscalYears();
    const storedById = await loadStoredEntriesByIds(repo, parsed);

    const entriesWithRef = await assignVoucherRefs(
      repo,
      tenant,
      parsed,
      new Map([...storedById].map(([id, stored]) => [id, stored.ref])),
    );

    if (repo.findActiveEntryRefs) {
      const incomingRefs = entriesWithRef.map((e) => e.ref.trim()).filter(Boolean);
      const activeRefs = await repo.findActiveEntryRefs(tenant, incomingRefs);
      const incomingIds = new Set(entriesWithRef.map((e) => e.id));
      for (const [ref, existingId] of activeRefs.entries()) {
        if (!incomingIds.has(existingId)) {
          throw new ConflictError(`A journal entry with reference "${ref}" already exists`);
        }
      }
    }

    const sanitized = entriesWithRef.map((entry) =>
      withServerOwnedSourceKeys(entry, storedById.get(entry.id)),
    );
    const withFx = await resolveEntriesFx(repo, tenant, sanitized);
    assertEntriesMutable(withFx, storedById);
    await assertEntriesWritable(tenant, withFx, storedById, fiscalYears, repo.findAccountsByIds);
    const prepared = withFx.map((entry) => prepareJournalEntryForPersist(entry, fiscalYears));
    try {
      return await upsertWithBroadcast(
        journalEntryListSchema,
        prepared,
        repo.bulkSaveEntries,
        "accounting_entries",
        { skipValidation: true },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        mapJournalEntryUniqueError(error);
      }
      throw error;
    }
  });
}

export async function createJournalEntryHelper(
  repo: AccountingRepository,
  loadFiscalYears: () => Promise<FiscalYear[]>,
  entryCrud: CrudService<JournalEntry>,
  record: JournalEntry,
): Promise<JournalEntry> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return withTenant(tenant, async () => {
    const id = record.id?.trim() || `je-${randomUUID()}`;
    await repo.lockJournalEntries(tenant, [id]);
    const fiscalYears = await loadFiscalYears();
    const existing = await repo.findEntryById(tenant, id);

    const typedRef = record.ref?.trim();
    if (typedRef && repo.findEntryByRef) {
      const conflicting = await repo.findEntryByRef(tenant, typedRef, { excludeId: id });
      if (conflicting) {
        throw new ConflictError(`A journal entry with reference "${typedRef}" already exists`);
      }
    }
    const [{ ref }] = await assignVoucherRefs(
      repo,
      tenant,
      [record],
      new Map(existing ? [[id, existing.ref]] : []),
    );

    const sanitized = withServerOwnedSourceKeys({ ...record, id, ref }, existing ?? undefined);
    const [withFx] = await resolveEntriesFx(repo, tenant, [sanitized]);
    const prepared = prepareJournalEntryForPersist(withFx, fiscalYears);
    if (existing) {
      if (existing.deletedAt || journalEntryContentChanged(prepared, existing)) {
        throw new ConflictError("A different journal entry already exists with this ID");
      }
      return existing;
    }
    assertJournalEntryPeriodOpen(sanitized, fiscalYears);
    await assertJournalAccountsWritable(tenant, [sanitized], repo.findAccountsByIds);
    try {
      return await entryCrud.create(prepared);
    } catch (error) {
      if (isUniqueViolation(error)) {
        mapJournalEntryUniqueError(error);
      }
      throw error;
    }
  });
}

export async function updateJournalEntryByIdHelper(
  repo: AccountingRepository,
  loadFiscalYears: () => Promise<FiscalYear[]>,
  entryCrud: CrudService<JournalEntry>,
  id: string,
  record: JournalEntry,
): Promise<JournalEntry | null> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return withTenant(tenant, async () => {
    await repo.lockJournalEntries(tenant, [id]);
    const fiscalYears = await loadFiscalYears();
    const existing = await repo.findEntryById(tenant, id);
    const ref = record.ref?.trim();
    if (ref && repo.findEntryByRef) {
      const conflicting = await repo.findEntryByRef(tenant, ref, { excludeId: id });
      if (conflicting) {
        throw new ConflictError(`A journal entry with reference "${ref}" already exists`);
      }
    }
    const effectiveRef = ref || existing?.ref;
    const sanitized = withServerOwnedSourceKeys(
      { ...record, id, ...(effectiveRef ? { ref: effectiveRef } : {}) },
      existing ?? undefined,
    );
    const storedById = new Map(existing ? [[existing.id, existing]] : []);
    const [withFx] = await resolveEntriesFx(repo, tenant, [sanitized]);
    assertEntriesMutable([withFx], storedById);
    assertJournalEntryPeriodOpen(withFx, fiscalYears);
    await assertJournalAccountsWritable(tenant, [withFx], repo.findAccountsByIds);
    try {
      return await entryCrud.updateById(id, prepareJournalEntryForPersist(withFx, fiscalYears));
    } catch (error) {
      if (isUniqueViolation(error)) {
        mapJournalEntryUniqueError(error);
      }
      throw error;
    }
  });
}

export async function deleteJournalEntryByIdHelper(
  repo: AccountingRepository,
  entryCrud: CrudService<JournalEntry>,
  id: string,
  deletedBy: string,
  deletionReason?: string,
): Promise<boolean> {
  const tenant = getRequestTenant();
  if (!tenant) return false;
  const existing = await repo.findEntryById(tenant, id);
  if (!existing || existing.deletedAt) return false;
  if (existing.status === "posted") {
    throw new Error("Posted journal entries cannot be deleted");
  }
  return entryCrud.deleteById(id, deletedBy, deletionReason);
}

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
