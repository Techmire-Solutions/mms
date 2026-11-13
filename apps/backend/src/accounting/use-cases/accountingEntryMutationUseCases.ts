import { randomUUID } from "node:crypto";
import type { AccountingRepository } from "../repository/accountingRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { ConflictError, HttpDomainError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { journalEntryListSchema, type JournalEntry, type FiscalYear } from "@mms/shared";
import { upsertWithBroadcast } from "../../services/tenantBulkService.js";
import { assignVoucherRefs } from "./journalVoucherRefs.js";
import {
  prepareJournalEntryForPersist,
  assertJournalEntryPeriodOpen,
  assertJournalAccountsWritable,
  assertEntriesMutable,
  assertEntriesWritable,
  assertPostingPeriodOpen,
  postedEntryIds,
  loadStoredEntriesByIds,
  withServerOwnedSourceKeys,
  mapJournalEntryUniqueError,
  journalEntryContentChanged,
} from "./accountingLedgerGuards.js";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { resolveEntriesFx } from "./journalEntryFx.js";
import { lockFiscalYearsForEntries } from "../ledgerPosting/fiscalYearPostingLock.js";
import { journalEntryAuditState, recordJournalEntryAudit } from "./accountingEntryAudit.js";

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
    // Lock every year the batch can land in (declared + date-derived) before the
    // period checks, so a concurrent close cannot flip one between check and
    // write; the years are re-read under the lock.
    await lockFiscalYearsForEntries(tenant, withFx, fiscalYears);
    const lockedYears = await loadFiscalYears();
    await assertEntriesWritable(
      tenant,
      withFx,
      storedById,
      lockedYears,
      repo.findAccountsByIds,
      repo.findClosedPostingPeriodForDate,
    );
    const prepared = withFx.map((entry) => prepareJournalEntryForPersist(entry, lockedYears));
    // Posted entries are immutable: keep their ledger rows out of the rewrite (0248).
    const preserveChildren = postedEntryIds(prepared, storedById);
    try {
      const saved = await upsertWithBroadcast(
        journalEntryListSchema,
        prepared,
        (tenant, list) => repo.bulkSaveEntries(tenant, list, { preserveChildren }),
        "accounting_entries",
        { skipValidation: true },
      );
      for (const entry of saved) {
        const before = storedById.get(entry.id);
        await recordJournalEntryAudit(
          tenant,
          before ? "UPDATE" : "CREATE",
          entry,
          before ? journalEntryAuditState(before) : null,
        );
      }
      return saved;
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
    // Serialise with the fiscal-year close for every year the entry can land in
    // (declared and date-derived), then re-resolve and re-check under the lock:
    // a close may have committed while we waited, and the year list may have
    // changed between the first read and the lock.
    await lockFiscalYearsForEntries(tenant, [prepared], fiscalYears);
    const lockedYears = await loadFiscalYears();
    const finalEntry = prepareJournalEntryForPersist(withFx, lockedYears);
    assertJournalEntryPeriodOpen(finalEntry, lockedYears);
    await assertPostingPeriodOpen(finalEntry.date, (date) =>
      repo.findClosedPostingPeriodForDate(tenant, date),
    );
    await assertJournalAccountsWritable(tenant, [finalEntry], repo.findAccountsByIds);
    try {
      const created = await entryCrud.create(finalEntry);
      await recordJournalEntryAudit(tenant, "CREATE", created);
      return created;
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
    const prepared = prepareJournalEntryForPersist(withFx, fiscalYears);
    await lockFiscalYearsForEntries(tenant, [prepared], fiscalYears);
    const lockedYears = await loadFiscalYears();
    const finalEntry = prepareJournalEntryForPersist(withFx, lockedYears);
    assertJournalEntryPeriodOpen(finalEntry, lockedYears);
    await assertPostingPeriodOpen(finalEntry.date, (date) =>
      repo.findClosedPostingPeriodForDate(tenant, date),
    );
    await assertJournalAccountsWritable(tenant, [finalEntry], repo.findAccountsByIds);
    try {
      const updated = await entryCrud.updateById(id, finalEntry);
      if (updated) {
        await recordJournalEntryAudit(
          tenant,
          "UPDATE",
          updated,
          existing ? journalEntryAuditState(existing) : null,
        );
      }
      return updated;
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
  return withTenant(tenant, async () => {
    const existing = await repo.findEntryById(tenant, id);
    if (!existing || existing.deletedAt) return false;
    if (existing.status === "posted") {
      throw new HttpDomainError(
        422,
        "validation_error",
        "Posted journal entries cannot be deleted",
      );
    }
    const archived = await entryCrud.deleteById(id, deletedBy, deletionReason);
    if (archived) {
      await recordJournalEntryAudit(tenant, "DELETE", existing, null, "journal_entry_archived");
    }
    return archived;
  });
}

export {
  bulkSoftDeleteJournalEntriesHelper,
  restoreJournalEntryByIdHelper,
} from "./accountingEntryLifecycleUseCases.js";
