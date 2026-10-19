import type { AccountingRepository } from "../repository/accountingRepository.js";
import { accountingRepository } from "../repository/accountingRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import {
  EMPTY_ACCOUNTING_REPORT_AGGREGATES,
  dedupeTrimmedIds,
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
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import {
  upsertEntriesHelper,
  createJournalEntryHelper,
  updateJournalEntryByIdHelper,
  deleteJournalEntryByIdHelper,
  restoreJournalEntryByIdHelper,
  bulkSoftDeleteJournalEntriesHelper,
} from "./accountingEntryMutationUseCases.js";
import {
  type AccountingUseCasesDependencies,
  upsertAccountsHelper,
  upsertFiscalYearsHelper,
  deleteAccountByIdHelper,
  bulkSoftDeleteAccountsHelper,
} from "./accountingAccountLifecycleUseCases.js";

export type { AccountingUseCasesDependencies };

const EMPTY_ACCOUNTING_METRICS: AccountingCommandMetricsSnapshot = {
  totalEntries: 0, posted: 0, draft: 0, activeAccounts: 0, inactiveAccounts: 0,
  newThisPeriod: 0, postedVolume: 0, revenue: 0, expenses: 0, surplus: 0, assets: 0, liabilities: 0,
};

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

  const deleteJournalEntryById = (id: string, deletedBy: string, deletionReason?: string) =>
    deleteJournalEntryByIdHelper(repo, entryCrud, id, deletedBy, deletionReason);

  const getActiveLineCount = async (tenant: string, accountId: string) => {
    if (deps?.countActiveJournalLinesForAccount) {
      return deps.countActiveJournalLinesForAccount(tenant, accountId);
    }
    const { countActiveJournalLinesForAccount } = await import(
      "../../db/repositories/accountingAccountsRepository.js"
    );
    return countActiveJournalLinesForAccount(tenant, accountId);
  };

  const getActiveLineCounts = async (tenant: string, accountIds: string[]) => {
    if (deps?.countActiveJournalLinesForAccounts) {
      return deps.countActiveJournalLinesForAccounts(tenant, accountIds);
    }
    const { countActiveJournalLinesForAccounts } = await import(
      "../../db/repositories/accountingAccountsRepository.js"
    );
    return countActiveJournalLinesForAccounts(tenant, accountIds);
  };

  return {
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

    upsertAccounts: (accounts: Account[]) => upsertAccountsHelper(repo, accounts),

    upsertEntries: (entries: JournalEntry[]) =>
      upsertEntriesHelper(repo, fiscalYearService.load, entries),

    upsertFiscalYears: (fiscalYears: FiscalYear[]) => upsertFiscalYearsHelper(repo, fiscalYears),

    createJournalEntry: (record: JournalEntry) =>
      createJournalEntryHelper(repo, fiscalYearService.load, entryCrud, record),

    updateJournalEntryById: (id: string, record: JournalEntry) =>
      updateJournalEntryByIdHelper(repo, fiscalYearService.load, entryCrud, id, record),

    restoreJournalEntryById: (id: string, userId?: string) =>
      restoreJournalEntryByIdHelper(repo, entryCrud, id, userId),

    bulkRestoreJournalEntries: entryCrud.bulkRestoreByIds,

    deleteJournalEntryById,

    bulkSoftDeleteJournalEntries: (
      ids: string[],
      deletedBy: string,
      deletionReason?: string,
    ) => bulkSoftDeleteJournalEntriesHelper(repo, deleteJournalEntryById, ids, deletedBy, deletionReason),

    deleteAccountById: (id: string, deletedBy: string, deletionReason?: string) =>
      deleteAccountByIdHelper(accountCrud, getActiveLineCount, id, deletedBy, deletionReason),

    restoreAccountById: accountCrud.restoreById,

    bulkSoftDeleteAccounts: (ids: string[], deletedBy: string, deletionReason?: string) =>
      bulkSoftDeleteAccountsHelper(accountCrud, getActiveLineCounts, ids, deletedBy, deletionReason),

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
