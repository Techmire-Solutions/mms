import type { AccountingRepository } from "../repository/accountingRepository.js";
import { accountingRepository } from "../repository/accountingRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  defineTenantBulkCollectionService,
  upsertWithBroadcast,
} from "../../services/tenantBulkService.js";
import {
  EMPTY_ACCOUNTING_REPORT_AGGREGATES,
  dedupeTrimmedIds,
  moneyToCents,
  type Account,
  type JournalEntry,
  type FiscalYear,
  type AccountingCommandMetricsSnapshot,
  type AccountingListQuery,
  type AccountingReportAggregates,
  type AccountingReportQuery,
  accountListSchema,
  journalEntryListSchema,
  fiscalYearListSchema,
  journalEntryRecordSchema,
  accountRecordSchema,
} from "@mms/shared";
import {
  prepareJournalEntryForPersist,
  assertJournalAccountsWritable,
  assertJournalEntryPeriodOpen,
} from "./accountingLedgerGuards.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { randomUUID } from "node:crypto";
import { assignVoucherRefs } from "./journalVoucherRefs.js";

const EMPTY_ACCOUNTING_METRICS: AccountingCommandMetricsSnapshot = {
  totalEntries: 0,
  posted: 0,
  draft: 0,
  activeAccounts: 0,
  inactiveAccounts: 0,
  newThisPeriod: 0,
  postedVolume: 0,
  revenue: 0,
  expenses: 0,
  surplus: 0,
  assets: 0,
  liabilities: 0,
};

function normalizeLines(lines: JournalEntry["lines"]): string {
  return (lines ?? [])
    .map((line) =>
      [
        line.account_id,
        moneyToCents(line.debit),
        moneyToCents(line.credit),
        line.description ?? "",
      ].join("|"),
    )
    .sort()
    .join(";");
}

function normalizeList(values: readonly string[] | undefined): string {
  return [...(values ?? [])].sort().join("|");
}

/**
 * True when a posted entry's financial content differs from what is stored.
 * Identity/audit fields (ids, created_by, timestamps) are intentionally ignored.
 */
function journalEntryContentChanged(incoming: JournalEntry, stored: JournalEntry): boolean {
  return (
    incoming.date !== stored.date ||
    (incoming.ref ?? "") !== (stored.ref ?? "") ||
    (incoming.description ?? "") !== (stored.description ?? "") ||
    incoming.status !== stored.status ||
    (incoming.fiscal_year ?? "") !== (stored.fiscal_year ?? "") ||
    (incoming.fiscal_year_id ?? "") !== (stored.fiscal_year_id ?? "") ||
    (incoming.source_type ?? "") !== (stored.source_type ?? "") ||
    (incoming.source_id ?? "") !== (stored.source_id ?? "") ||
    (incoming.transaction_type ?? "") !== (stored.transaction_type ?? "") ||
    (incoming.reversed_ref ?? "") !== (stored.reversed_ref ?? "") ||
    Boolean(incoming.simple_mode) !== Boolean(stored.simple_mode) ||
    normalizeLines(incoming.lines) !== normalizeLines(stored.lines) ||
    normalizeList(incoming.tags) !== normalizeList(stored.tags) ||
    normalizeList(incoming.attachments) !== normalizeList(stored.attachments)
  );
}

function mapJournalEntryUniqueError(error: unknown): never {
  const pgErr = error as { constraint?: string; message?: string };
  if (
    pgErr.constraint === "accounting_entries_workspace_ref_active_uidx" ||
    pgErr.message?.includes("accounting_entries_workspace_ref_active_uidx")
  ) {
    throw new ConflictError("A journal entry with this reference already exists");
  }
  throw new ConflictError(
    "A journal entry already exists for this source (conflicting source_type/source_id)",
  );
}

export interface AccountingUseCasesDependencies {
  countActiveJournalLinesForAccount?: (tenant: string, accountId: string) => Promise<number>;
  countActiveJournalLinesForAccounts?: (
    tenant: string,
    accountIds: string[],
  ) => Promise<Map<string, number>>;
}

/**
 * Accounting use-cases — composition root binding an {@link AccountingRepository}
 * to every operation. Production uses the default Drizzle-backed
 * `accountingUseCases`; tests can pass a fake repository to exercise
 * orchestration in isolation.
 */
export function createAccountingUseCases(
  repo: AccountingRepository = accountingRepository,
  deps?: AccountingUseCasesDependencies,
) {
  const accountService = defineTenantBulkCollectionService<Account>(
    {
      listByWorkspace: repo.listAccountsByWorkspace,
      replaceForWorkspace: repo.replaceAccountsForWorkspace,
    },
    accountListSchema,
    "accounting_accounts",
  );

  const entryBulkService = defineTenantBulkCollectionService<JournalEntry>(
    {
      listByWorkspace: repo.listEntriesByWorkspace,
      replaceForWorkspace: repo.replaceEntriesForWorkspace,
    },
    journalEntryListSchema,
    "accounting_entries",
  );

  const fiscalYearService = defineTenantBulkCollectionService<FiscalYear>(
    {
      listByWorkspace: repo.listFiscalYearsByWorkspace,
      replaceForWorkspace: repo.replaceFiscalYearsForWorkspace,
    },
    fiscalYearListSchema,
    "accounting_fiscal_years",
  );

  const entryCrud = createGenericRelationalService<JournalEntry>({
    repo: {
      listByWorkspace: repo.listEntriesByWorkspace,
      findById: repo.findEntryById,
      save: repo.saveEntry,
      bulkDelete: repo.bulkSoftDeleteEntries,
      bulkRestore: repo.bulkRestoreEntries,
    },
    schema: journalEntryRecordSchema,
    websocketCollection: "accounting_entries",
    idPrefix: "je",
  });

  const accountCrud = createGenericRelationalService<Account>({
    repo: {
      listByWorkspace: repo.listAccountsByWorkspace,
      findById: repo.findAccountById,
      save: repo.saveAccount,
      bulkDelete: repo.bulkSoftDeleteAccounts,
      bulkRestore: repo.bulkRestoreAccounts,
    },
    schema: accountRecordSchema,
    websocketCollection: "accounting_accounts",
    idPrefix: "acc",
  });

  /**
   * Loads the stored rows for `entries` in one query so the mutability check and
   * the write can share a single transaction. Reading posted ids in a separate
   * transaction left a window where a concurrent writer could post an entry
   * between the check and the write.
   */
  const loadStoredEntriesByIds = async (
    entries: readonly JournalEntry[],
  ): Promise<Map<string, JournalEntry>> => {
    const tenant = getRequestTenant();
    if (!tenant) return new Map();
    const ids = dedupeTrimmedIds(entries.map((entry) => entry.id));
    if (ids.length === 0) return new Map();
    const stored = await repo.findEntriesByIds(tenant, ids);
    return new Map(stored.map((entry) => [entry.id, entry]));
  };

  /**
   * `source_type` / `source_id` are the idempotency keys the finance module uses
   * to post at most once per invoice, payment or credit note. They are
   * server-owned: a client able to set them could pre-claim a source and
   * silently suppress the real system posting, or forge a reversal/closing
   * marker. Existing rows keep their stored keys; new rows written through a
   * client route are always `manual`. `reversed_ref` is owned the same way: a
   * reversal link is only created by `POST /entries/:id/reverse`, which checks
   * eligibility, period and duplicate reversal under a lock.
   */
  const withServerOwnedSourceKeys = (
    entry: JournalEntry,
    stored: JournalEntry | undefined,
  ): JournalEntry => ({
    ...entry,
    source_type: stored ? stored.source_type : "manual",
    source_id: stored ? stored.source_id : undefined,
    reversed_ref: stored ? stored.reversed_ref : undefined,
  });

  /**
   * Append-only immutability: posted journal entries may not be edited in
   * place — corrections must be posted as reversals/adjustments. Unchanged
   * posted rows are tolerated because the Work directory saves the whole
   * collection back through the bulk upsert route.
   */
  const assertEntriesMutable = (
    entries: readonly JournalEntry[],
    storedById: ReadonlyMap<string, JournalEntry>,
  ): void => {
    for (const incoming of entries) {
      const existing = storedById.get(incoming.id);
      if (!existing || existing.status !== "posted") continue;
      if (journalEntryContentChanged(incoming, existing)) {
        throw Object.assign(
          new Error("Posted journal entries are immutable — reverse them instead of editing"),
          { statusCode: 422, type: "validation_error" },
        );
      }
    }
  };

  /**
   * Active foreign-key guard: a journal line may not reference an unknown,
   * archived or deactivated account.
   *
   * The table's FK only enforces existence, archiving is a soft delete (the row
   * survives), and the chart-of-accounts UI's only "delete" action sets
   * `isActive: false`. So both flags have to be honoured here or the client and
   * the server disagree about what removal means: the picker hides an account
   * while invoice posting, imports and the API keep writing to it.
   */
  const assertEntryAccountsWritable = (
    tenant: string,
    entries: readonly JournalEntry[],
  ): Promise<void> => assertJournalAccountsWritable(tenant, entries, repo.findAccountsByIds);

  /**
   * Period lock plus account guard, applied to **new-or-changed** entries only.
   *
   * Unchanged rows are re-sent by whole-collection Work-tier saves and must stay
   * writable even once their fiscal year has closed or one of their accounts has
   * been archived — otherwise any workspace that closes a year could no longer
   * save its journal at all.
   */
  const assertEntriesWritable = async (
    tenant: string,
    entries: readonly JournalEntry[],
    storedById: ReadonlyMap<string, JournalEntry>,
    fiscalYears: readonly FiscalYear[],
  ): Promise<void> => {
    const targets = entries.filter((entry) => {
      const existing = storedById.get(entry.id);
      return !existing || journalEntryContentChanged(entry, existing);
    });
    if (targets.length === 0) return;
    for (const entry of targets) assertJournalEntryPeriodOpen(entry, fiscalYears);
    await assertEntryAccountsWritable(tenant, targets);
  };

  /**
   * Fiscal years may not be reopened, rewritten once closed, or closed by hand.
   *
   * `status === 'closed'` is the single switch the whole period lock keys off,
   * so writing it through the generic bulk collection route would let any user
   * with accounting write access undo an immutable period. Closing must go
   * through `closeFiscalYear`, which also posts the closing entry and requires a
   * retained-earnings account.
   */
  const assertFiscalYearWritesAllowed = async (incoming: readonly FiscalYear[]): Promise<void> => {
    const tenant = getRequestTenant();
    if (!tenant || incoming.length === 0) return;
    const stored = await repo.findFiscalYearsByIds(
      tenant,
      dedupeTrimmedIds(incoming.map((year) => year.id)),
    );
    const storedById = new Map(stored.map((year) => [year.id, year]));
    for (const year of incoming) {
      if (year.deletedAt || year.deletedBy || year.deletionReason) {
        throw Object.assign(
          new Error("Fiscal year lifecycle fields cannot be changed through bulk saves"),
          {
            statusCode: 422,
            type: "validation_error",
          },
        );
      }
      const existing = storedById.get(year.id);
      const isClosed = year.status === "closed";
      if (existing?.status === "closed") {
        if (!isClosed) {
          throw Object.assign(
            new Error("A closed fiscal year cannot be reopened — post an adjustment instead"),
            { statusCode: 422, type: "validation_error" },
          );
        }
        if (existing.startDate !== year.startDate || existing.endDate !== year.endDate) {
          throw Object.assign(
            new Error("A closed fiscal year cannot have its date range changed"),
            { statusCode: 422, type: "validation_error" },
          );
        }
        continue;
      }
      if (isClosed) {
        throw Object.assign(
          new Error("Fiscal years must be closed through the close-fiscal-year action"),
          { statusCode: 422, type: "validation_error" },
        );
      }
    }
  };

  const deleteJournalEntryById = async (
    id: string,
    deletedBy: string,
    deletionReason?: string,
  ): Promise<boolean> => {
    const tenant = getRequestTenant();
    if (!tenant) return false;
    const existing = await repo.findEntryById(tenant, id);
    if (!existing || existing.deletedAt) return false;
    if (existing.status === "posted") {
      throw new Error("Posted journal entries cannot be deleted");
    }
    return entryCrud.deleteById(id, deletedBy, deletionReason);
  };

  return {
    /** Full-collection replace retained for internal/admin tools only — routes must use upsert. */
    replaceAccounts: accountService.replace,
    replaceEntries: entryBulkService.replace,
    replaceFiscalYears: fiscalYearService.replace,

    loadAccounts: (options?: { includeDeleted?: boolean }) => accountCrud.loadAll(options),

    loadAccountById: async (id: string, includeDeleted = false): Promise<Account | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const row = await repo.findAccountById(tenant, cleanId);
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      return row;
    },

    loadAccountsByIds: async (ids: string[], includeDeleted = false): Promise<Account[]> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant || cleanIds.length === 0) return [];
      return repo.findAccountsByIds(tenant, cleanIds, { includeDeleted });
    },

    loadEntries: (options?: { includeDeleted?: boolean }) => entryCrud.loadAll(options),

    loadEntryById: async (id: string, includeDeleted = false): Promise<JournalEntry | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const row = await repo.findEntryById(tenant, cleanId);
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      return row;
    },

    loadEntriesByIds: async (ids: string[], includeDeleted = false): Promise<JournalEntry[]> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant || cleanIds.length === 0) return [];
      return repo.findEntriesByIds(tenant, cleanIds, { includeDeleted });
    },

    loadFiscalYears: async (options?: { includeDeleted?: boolean }): Promise<FiscalYear[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      return repo.listFiscalYearsByWorkspace(tenant, options);
    },

    loadFiscalYearById: async (id: string, includeDeleted = false): Promise<FiscalYear | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const row = await repo.findFiscalYearById(tenant, cleanId);
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      return row;
    },

    loadFiscalYearsByIds: async (ids: string[], includeDeleted = false): Promise<FiscalYear[]> => {
      const tenant = getRequestTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant || cleanIds.length === 0) return [];
      return repo.findFiscalYearsByIds(tenant, cleanIds, { includeDeleted });
    },

    upsertAccounts: (accounts: Account[]) =>
      upsertWithBroadcast(
        accountListSchema,
        accounts,
        repo.bulkSaveAccounts,
        "accounting_accounts",
      ),
    /**
     * Runs the immutability, period and account guards and the write inside one
     * transaction. The route that serves this (`PUT {path}/bulk`) opens no
     * transaction of its own, so guard-then-write in separate transactions left
     * a window for a concurrent writer to post an entry between the two.
     */
    upsertEntries: async (entries: JournalEntry[]) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      return withTenant(tenant, async () => {
        const parsed = journalEntryListSchema.parse(entries);
        await repo.lockJournalEntries(
          tenant,
          parsed.map((entry) => entry.id),
        );
        const fiscalYears = await fiscalYearService.load();
        const storedById = await loadStoredEntriesByIds(parsed);

        const entriesWithRef = await assignVoucherRefs(
          repo,
          tenant,
          parsed,
          new Map([...storedById].map(([id, stored]) => [id, stored.ref])),
        );

        // DB duplicate check for incoming refs against existing entries
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
        assertEntriesMutable(sanitized, storedById);
        await assertEntriesWritable(tenant, sanitized, storedById, fiscalYears);
        const prepared = sanitized.map((entry) =>
          prepareJournalEntryForPersist(entry, fiscalYears),
        );
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
    },
    upsertFiscalYears: async (fiscalYears: FiscalYear[]) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      return withTenant(tenant, async () => {
        await assertFiscalYearWritesAllowed(fiscalYears);
        return upsertWithBroadcast(
          fiscalYearListSchema,
          fiscalYears,
          repo.bulkSaveFiscalYears,
          "accounting_fiscal_years",
        );
      });
    },

    createJournalEntry: async (record: JournalEntry) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      return withTenant(tenant, async () => {
        const id = record.id?.trim() || `je-${randomUUID()}`;
        await repo.lockJournalEntries(tenant, [id]);
        const fiscalYears = await fiscalYearService.load();
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
        const prepared = prepareJournalEntryForPersist(sanitized, fiscalYears);
        if (existing) {
          if (existing.deletedAt || journalEntryContentChanged(prepared, existing)) {
            throw new ConflictError("A different journal entry already exists with this ID");
          }
          return existing;
        }
        assertJournalEntryPeriodOpen(sanitized, fiscalYears);
        await assertEntryAccountsWritable(tenant, [sanitized]);
        try {
          return await entryCrud.create(prepared);
        } catch (error) {
          if (isUniqueViolation(error)) {
            mapJournalEntryUniqueError(error);
          }
          throw error;
        }
      });
    },
    updateJournalEntryById: async (id: string, record: JournalEntry) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      return withTenant(tenant, async () => {
        await repo.lockJournalEntries(tenant, [id]);
        const fiscalYears = await fiscalYearService.load();
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
        assertEntriesMutable([sanitized], storedById);
        assertJournalEntryPeriodOpen(sanitized, fiscalYears);
        await assertEntryAccountsWritable(tenant, [sanitized]);
        try {
          return await entryCrud.updateById(
            id,
            prepareJournalEntryForPersist(sanitized, fiscalYears),
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            mapJournalEntryUniqueError(error);
          }
          throw error;
        }
      });
    },
    restoreJournalEntryById: async (id: string, userId?: string) => {
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
    },
    bulkRestoreJournalEntries: entryCrud.bulkRestoreByIds,

    deleteJournalEntryById,

    bulkSoftDeleteJournalEntries: async (
      ids: string[],
      deletedBy: string,
      deletionReason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
      const tenant = getRequestTenant();
      if (repo.bulkSoftDeleteEntries && tenant) {
        const result = await repo.bulkSoftDeleteEntries(
          tenant,
          cleanIds,
          deletedBy,
          deletionReason,
        );
        if (result.succeeded > 0) {
          const { broadcastTenantUpdate } = await import("../../services/websocketService.js");
          broadcastTenantUpdate(tenant, "collection", "accounting_entries");
        }
        return result;
      }
      let succeeded = 0;
      let failed = 0;
      for (const id of cleanIds) {
        try {
          const ok = await deleteJournalEntryById(id, deletedBy, deletionReason);
          if (ok) succeeded += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { succeeded, failed };
    },

    deleteAccountById: async (
      id: string,
      deletedBy: string,
      deletionReason?: string,
    ): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const cleanId = id?.trim();
      if (!cleanId) return false;
      const getActiveCount =
        deps?.countActiveJournalLinesForAccount ??
        (await import("../../db/repositories/accountingAccountsRepository.js"))
          .countActiveJournalLinesForAccount;
      const activeCount = await getActiveCount(tenant, cleanId);
      if (activeCount > 0) {
        const err = new Error("Cannot archive account with active ledger entries");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
      return accountCrud.deleteById(cleanId, deletedBy, deletionReason);
    },
    restoreAccountById: accountCrud.restoreById,
    bulkSoftDeleteAccounts: async (
      ids: string[],
      deletedBy: string,
      deletionReason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      if (!tenant) return { succeeded: 0, failed: ids.length };
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
      const getActiveCounts =
        deps?.countActiveJournalLinesForAccounts ??
        (await import("../../db/repositories/accountingAccountsRepository.js"))
          .countActiveJournalLinesForAccounts;
      const activeCounts = await getActiveCounts(tenant, cleanIds);
      const blockedIds = new Set<string>();
      for (const [accId, count] of activeCounts.entries()) {
        if (count > 0) blockedIds.add(accId);
      }
      const allowedIds = cleanIds.filter((id) => !blockedIds.has(id));
      if (allowedIds.length === 0) {
        return { succeeded: 0, failed: cleanIds.length };
      }
      const result = await accountCrud.bulkDeleteByIds(allowedIds, deletedBy, deletionReason);
      return {
        succeeded: result.succeeded,
        failed: result.failed + blockedIds.size,
      };
    },
    bulkRestoreAccounts: accountCrud.bulkRestoreByIds,

    loadAccountsPage: async (query: AccountingListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          accounts: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listAccountsPage(tenant, query);
    },

    loadEntriesPage: async (query: AccountingListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          entries: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listEntriesPage(tenant, query);
    },

    loadFiscalYearsPage: async (query: AccountingListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          fiscalYears: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listFiscalYearsPage(tenant, query);
    },

    loadAccountingCommandMetrics: async (): Promise<AccountingCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_ACCOUNTING_METRICS;
      return repo.aggregateAccountingCommandMetrics(tenant);
    },

    loadAccountingReportAggregates: async (
      query: AccountingReportQuery = {},
    ): Promise<AccountingReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) return EMPTY_ACCOUNTING_REPORT_AGGREGATES;
      // The report classifies cash / receivables / payables. The configured
      // posting rules are authoritative for those, so resolve them here instead
      // of letting the SQL layer guess from account codes and names.
      const postingRules = await getPostingRules(tenant);
      const { arAccountId, cashAccountId, incomeAccountId, discountAccountId } = postingRules ?? {};
      return repo.aggregateAccountingReport(tenant, {
        ...query,
        postingRules: { arAccountId, cashAccountId, incomeAccountId, discountAccountId },
      });
    },
  };
}

export const accountingUseCases = createAccountingUseCases();
