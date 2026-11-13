import type { PostingPeriod } from "@mms/shared";
import type {
  Account,
  JournalEntry,
  FiscalYear,
  AccountingListQuery,
  AccountingAccountsListPageResult,
  AccountingEntriesListPageResult,
  AccountingFiscalYearsListPageResult,
  AccountingCommandMetricsSnapshot,
  AccountingReportAggregates,
  AccountingReportQuery,
  LedgerPostingAccounts,
} from "@mms/shared";
import type { AccountingFxRepository } from "./accountingFxRepository.js";

/**
 * Sole storage gateway for the accounting module (accounts, journal entries,
 * fiscal years).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`/
 * `questionBank`/`examinations`/`obligations` reference pattern: routes and
 * use-cases depend on this interface (never on Drizzle directly), and the
 * Drizzle-backed adapter is the only implementation. Tests can inject a fake
 * repository at the seam.
 */
export interface AccountingRepository {
  // Accounts
  listAccountsByWorkspace(
    tenant: string,
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<Account[]>;
  findAccountById(tenant: string, id: string): Promise<Account | null>;
  findAccountsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<Account[]>;
  saveAccount(tenant: string, record: Account): Promise<void>;
  bulkSaveAccounts(tenant: string, records: Account[]): Promise<void>;
  replaceAccountsForWorkspace(tenant: string, records: Account[]): Promise<void>;
  listAccountsPage(
    tenant: string,
    query: AccountingListQuery,
  ): Promise<AccountingAccountsListPageResult>;
  bulkSoftDeleteAccounts?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreAccounts?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  // Journal entries
  lockJournalEntries(tenant: string, ids: string[]): Promise<void>;
  listEntriesByWorkspace(
    tenant: string,
    options?: {
      deleted?: "active" | "deleted" | "all";
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<JournalEntry[]>;
  findEntryById(tenant: string, id: string): Promise<JournalEntry | null>;
  findEntryByRef?(
    tenant: string,
    ref: string,
    options?: { excludeId?: string },
  ): Promise<JournalEntry | null>;
  findActiveEntryRefs?(tenant: string, refs: readonly string[]): Promise<Map<string, string>>;
  /** Issues voucher numbers inside the caller's write transaction; `null` when auto-numbering is off. */
  allocateVoucherNumbers?(
    tenant: string,
    options: { date?: string; count?: number; reserved?: ReadonlySet<string> },
  ): Promise<string[] | null>;
  findEntriesByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<JournalEntry[]>;
  /**
   * Label of the closed posting period covering `date`, or null. Required (not
   * optional): the monthly lock must not disappear merely because a caller or a
   * test double forgot to provide it.
   */
  findClosedPostingPeriodForDate(tenant: string, date: string): Promise<string | null>;
  /** Posting periods of a fiscal year (all when omitted). */
  listPostingPeriods(tenant: string, fiscalYearId?: string): Promise<PostingPeriod[]>;
  findPostingPeriodById(tenant: string, id: string): Promise<PostingPeriod | null>;
  /** Locks/unlocks one period; the fiscal-year lock is the caller's. */
  setPostingPeriodStatus(
    tenant: string,
    id: string,
    status: "open" | "closed",
    actorId: string,
  ): Promise<PostingPeriod | null>;
  saveEntry(tenant: string, record: JournalEntry): Promise<void>;
  /**
   * `preserveChildren` lists entries whose lines/tags/attachments must not be
   * rewritten. The caller passes the posted entries of the batch: their content
   * is immutable (posted entries are only ever sent unchanged), so the child
   * delete+reinsert would be a no-op that still touches the ledger rows — and
   * the database rejects any such write (0248 journal-line immutability).
   */
  bulkSaveEntries(
    tenant: string,
    records: JournalEntry[],
    options?: { preserveChildren?: ReadonlySet<string> },
  ): Promise<void>;
  replaceEntriesForWorkspace(tenant: string, records: JournalEntry[]): Promise<void>;
  listEntriesPage(
    tenant: string,
    query: AccountingListQuery,
  ): Promise<AccountingEntriesListPageResult>;
  bulkSoftDeleteEntries?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestoreEntries?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  // Fiscal years
  listFiscalYearsByWorkspace(
    tenant: string,
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<FiscalYear[]>;
  findFiscalYearById(tenant: string, id: string): Promise<FiscalYear | null>;
  findFiscalYearsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<FiscalYear[]>;
  saveFiscalYear(tenant: string, record: FiscalYear): Promise<void>;
  bulkSaveFiscalYears(tenant: string, records: FiscalYear[]): Promise<void>;
  replaceFiscalYearsForWorkspace(tenant: string, records: FiscalYear[]): Promise<void>;
  listFiscalYearsPage(
    tenant: string,
    query: AccountingListQuery,
  ): Promise<AccountingFiscalYearsListPageResult>;

  // Aggregates
  aggregateAccountingCommandMetrics(
    tenant: string,
    periodDays?: number,
  ): Promise<AccountingCommandMetricsSnapshot>;
  aggregateAccountingReport(
    tenant: string,
    query?: AccountingReportRequest,
  ): Promise<AccountingReportAggregates>;

  /** IAS 21 currency settings and rates; absent in fakes that only book in one currency. */
  fx?: AccountingFxRepository;
}

/**
 * Report request extended with the resolved posting rules.
 *
 * The HTTP query schema deliberately does not accept posting rules — callers may
 * not choose which accounts count as cash or receivables — so the server
 * resolves them from configuration and threads them through here.
 */
export interface AccountingReportRequest extends AccountingReportQuery {
  postingRules?: Partial<LedgerPostingAccounts>;
}
