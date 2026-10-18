import type React from "react";
import { ErrorState } from "@/components/app/ErrorState";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { AccountingDashboard } from "@/tenant/features/accounting/components/AccountingDashboard";
import { ChartOfAccounts } from "@/tenant/features/accounting/components/ChartOfAccounts";
import { GeneralLedger } from "@/tenant/features/accounting/components/GeneralLedger";
import { JournalEntries } from "@/tenant/features/accounting/components/JournalEntries";
import type {
  JournalEntriesListPaging,
  JournalEntryFilterState,
} from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";
import { TrialBalance } from "@/tenant/features/accounting/components/TrialBalance";
import type { Account, AccountingSettings, FiscalYear, JournalEntry } from "@mms/shared";
import type { JournalEntriesChange } from "../lib/journalEntriesTypes";

type AccountingSubTab = {
  id: string;
  label: string;
};

type JournalColumnProps = Pick<
  React.ComponentProps<typeof JournalEntries>,
  "isColumnVisible" | "getColumnWidth" | "onColumnResize" | "columnCustomizer"
>;

type AccountColumnProps = Pick<
  React.ComponentProps<typeof ChartOfAccounts>,
  "isColumnVisible" | "getColumnWidth" | "onColumnResize" | "columnCustomizer"
>;

interface AccountingWorkTierProps {
  subTabs: AccountingSubTab[];
  activeSubTab: string;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  listLoadFailed: boolean;
  createJournalRequestKey?: number;
  createAccountRequestKey?: number;
  accounts: Account[];
  accountsLoaded?: boolean;
  entries: JournalEntry[];
  /**
   * The complete journal, used by the whole-ledger views (Overview, General
   * Ledger, Trial Balance). `entries` is a single page and would silently
   * understate every aggregate; it stays the source for the paginated Journal
   * list and for saves, so a save never re-uploads the entire journal.
   */
  aggregateEntries: JournalEntry[];
  settings: AccountingSettings;
  fiscalYears: FiscalYear[];
  /** Journal filter values, owned by the page that issues the server query. */
  journalFilters: JournalEntryFilterState;
  onJournalFiltersChange: (patch: Partial<JournalEntryFilterState>) => void;
  /** Pager state for the server-driven journal page. */
  journalPaging: JournalEntriesListPaging;
  onSubTabChange: (tab: string) => void;
  onShowDeletedChange: () => void;
  onRetry: () => void;
  onAccountsChange: (updater: Account[] | ((prev: Account[]) => Account[])) => Promise<void>;
  onEntriesChange: JournalEntriesChange;
  onFilteredCountChange: (count: number) => void;
  onShortcutStateChange?: React.ComponentProps<typeof JournalEntries>["onShortcutStateChange"];
  onDeleteEntry: (id: string) => Promise<void>;
  onRestoreEntry: (id: string) => Promise<void>;
  onBulkDeleteEntries: (ids: string[]) => Promise<void>;
  onBulkRestoreEntries: (ids: string[]) => Promise<void>;
  journalColumnProps?: JournalColumnProps;
  accountColumnProps?: AccountColumnProps;
  showActiveLabel?: string;
  showDeletedLabel?: string;
  loadFailedTitle?: string;
}

export function AccountingWorkTier({
  subTabs,
  activeSubTab,
  canWrite,
  canDelete,
  showDeleted,
  listLoadFailed,
  createJournalRequestKey,
  createAccountRequestKey,
  accounts,
  accountsLoaded,
  entries,
  aggregateEntries,
  settings,
  fiscalYears,
  journalFilters,
  onJournalFiltersChange,
  journalPaging,
  onSubTabChange,
  onShowDeletedChange,
  onRetry,
  onAccountsChange,
  onEntriesChange,
  onFilteredCountChange,
  onShortcutStateChange,
  onDeleteEntry,
  onRestoreEntry,
  onBulkDeleteEntries,
  onBulkRestoreEntries,
  journalColumnProps,
  accountColumnProps,
  showActiveLabel: _showActiveLabel,
  showDeletedLabel: _showDeletedLabel,
  loadFailedTitle,
}: AccountingWorkTierProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <SubTabBar
        tabs={subTabs.map((tab) => ({ key: tab.id, label: tab.label }))}
        value={activeSubTab}
        onChange={onSubTabChange}
      />

      {listLoadFailed && (
        <ErrorState
          title={loadFailedTitle}
          description={t("accounting.loadFailedHint")}
          onRetry={onRetry}
        />
      )}

      {!listLoadFailed && activeSubTab === "overview" && (
        <AccountingDashboard
          accounts={accounts}
          entries={aggregateEntries}
          settings={settings}
          fiscalYears={fiscalYears}
        />
      )}

      {!listLoadFailed && activeSubTab === "journal" && (
        <JournalEntries
          entries={entries}
          allEntries={aggregateEntries.length > 0 ? aggregateEntries : undefined}
          accounts={accounts}
          settings={settings}
          fiscalYears={fiscalYears}
          onChange={onEntriesChange}
          onAccountsChange={onAccountsChange}
          onFilteredCountChange={onFilteredCountChange}
          onShortcutStateChange={onShortcutStateChange}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          onToggleDeleted={onShowDeletedChange}
          createRequestKey={createJournalRequestKey}
          onDelete={onDeleteEntry}
          onRestore={onRestoreEntry}
          onBulkDelete={onBulkDeleteEntries}
          onBulkRestore={onBulkRestoreEntries}
          filters={journalFilters}
          onFiltersChange={onJournalFiltersChange}
          paging={journalPaging}
          {...journalColumnProps}
        />
      )}

      {!listLoadFailed && activeSubTab === "ledger" && (
        <GeneralLedger accounts={accounts} entries={aggregateEntries} />
      )}

      {!listLoadFailed && activeSubTab === "trial" && (
        <TrialBalance accounts={accounts} entries={aggregateEntries} fiscalYears={fiscalYears} />
      )}

      {!listLoadFailed && activeSubTab === "coa" && (
        <ChartOfAccounts
          accounts={accounts}
          accountsLoaded={accountsLoaded}
          onChange={onAccountsChange}
          onFilteredCountChange={onFilteredCountChange}
          canWrite={canWrite}
          createRequestKey={createAccountRequestKey}
          {...accountColumnProps}
        />
      )}
    </>
  );
}
