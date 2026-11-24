import type {
  Account,
  ConsolidationGroup,
  ConsolidationGroupPut,
  ConsolidationReport,
  ConsolidationReportQuery,
  FiscalYear,
  JournalEntry,
  MemberTrialBalanceRow,
} from "@mms/contracts";

export interface AccountingTenantContext {
  tenantId: string;
  actorId: string;
  actorRole?: string;
  requestId: string;
}

export interface AccountingPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AccountingPorts {
  tenant: {
    listAccounts(ctx: AccountingTenantContext): Promise<Account[]>;
    listJournalEntries(
      ctx: AccountingTenantContext,
      query: { page: number; limit: number; fiscalYear?: string; status?: string },
    ): Promise<AccountingPage<JournalEntry>>;
    saveJournalEntry(ctx: AccountingTenantContext, entry: JournalEntry): Promise<JournalEntry>;
    reverseJournalEntry(
      ctx: AccountingTenantContext,
      id: string,
      reason: string,
    ): Promise<JournalEntry>;
    listFiscalYears(ctx: AccountingTenantContext): Promise<FiscalYear[]>;
    closeFiscalYear(ctx: AccountingTenantContext, id: string): Promise<FiscalYear>;
    buildTrialBalance(
      ctx: AccountingTenantContext,
      query: { dateFrom: string; dateTo: string },
    ): Promise<MemberTrialBalanceRow[]>;
  };
  platform: {
    listConsolidationGroups(): Promise<ConsolidationGroup[]>;
    saveConsolidationGroup(id: string, input: ConsolidationGroupPut): Promise<ConsolidationGroup>;
    deleteConsolidationGroup(id: string): Promise<boolean>;
    buildConsolidationReport(
      id: string,
      query: ConsolidationReportQuery,
    ): Promise<ConsolidationReport>;
    insertPlatformActivity(input: {
      actorId: string;
      actorEmail: string;
      action: string;
      targetId: string;
      message: string;
    }): Promise<void>;
  };
}
