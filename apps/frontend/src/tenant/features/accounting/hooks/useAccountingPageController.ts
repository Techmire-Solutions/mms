import { useState, useEffect } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useAccountingPageShortcuts } from "@/tenant/features/accounting/hooks/useAccountingPageShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useAccountingJournalColumnLayout } from "@/tenant/features/accounting/hooks/useAccountingJournalColumnLayout";
import { useAccountingAccountColumnLayout } from "@/tenant/features/accounting/hooks/useAccountingAccountColumnLayout";
import { useAccountingConfig } from "@/hooks/useStandardModuleConfig";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import {
  ACCOUNTING_MODULE_MANIFEST,
  type Account,
  type JournalEntry,
  type FiscalYear,
} from "@mms/shared";
import {
  useAccountingFiscalYearsPaginated,
  useAllAccountingAccounts,
  useAllAccountingEntries,
} from "./useAccountingApi";
import { useAccountingEntriesPage } from "./accountingListFetch";
import { useJournalEntriesListQueryState } from "@/tenant/features/accounting/components/journalEntriesControllerFilters";
import { useAccountingPageActions } from "@/tenant/features/accounting/hooks/useAccountingPageActions";
import {
  ACCOUNTING_SUB_TAB_ICONS,
  ACCOUNTING_SUB_TAB_IDS,
  ACCOUNTING_SUB_TAB_KEYS,
} from "@/tenant/features/accounting/accountingPageSubTabs";

export function useAccountingPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(ACCOUNTING_MODULE_MANIFEST);
  const pageTabs = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.accounting",
  });
  const subTabs = ACCOUNTING_SUB_TAB_IDS.map((subTabId) => ({
    id: subTabId,
    label: t(ACCOUNTING_SUB_TAB_KEYS[subTabId]),
    icon: ACCOUNTING_SUB_TAB_ICONS[subTabId],
  }));
  const [activeTab, setActiveTab] = usePersistedTabState<string>("accounting_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [createJournalRequestKey, setCreateJournalRequestKey] = useState(0);
  const [createAccountRequestKey, setCreateAccountRequestKey] = useState(0);

  const accountsResult = useAllAccountingAccounts({ includeDeleted: false });
  const journalList = useJournalEntriesListQueryState(showDeleted);
  const entriesResult = useAccountingEntriesPage(journalList.query);
  const fiscalYearsResult = useAccountingFiscalYearsPaginated({ page: 1, limit: 100 });

  const aggregateSubTab =
    activeTab === "work" &&
    (activeSubTab === "overview" || activeSubTab === "ledger" || activeSubTab === "trial");
  const aggregateEntriesResult = useAllAccountingEntries(
    { includeDeleted: false },
    { enabled: aggregateSubTab },
  );
  const accountsEnvelope = accountsResult.data as {
    body?: { accounts?: Account[] };
    accounts?: Account[];
  } | null;
  const fiscalYearsEnvelope = fiscalYearsResult.data as {
    body?: { fiscalYears?: FiscalYear[] };
    fiscalYears?: FiscalYear[];
  } | null;
  const accounts: Account[] = Array.isArray(accountsResult.data)
    ? accountsResult.data
    : (accountsEnvelope?.body?.accounts ?? accountsEnvelope?.accounts ?? []);
  const journalEntries: JournalEntry[] = entriesResult.data?.entries ?? [];
  const journalTotal = entriesResult.data?.total ?? 0;
  const aggregateEntries: JournalEntry[] = aggregateEntriesResult.data ?? [];
  const fiscalYears: FiscalYear[] =
    fiscalYearsEnvelope?.body?.fiscalYears ?? fiscalYearsEnvelope?.fiscalYears ?? [];
  const { settings } = useAccountingConfig();
  const { activeCurrency } = useAccountingCurrency();
  const [filteredCount, setFilteredCount] = useState(0);
  const journalColumnLayout = useAccountingJournalColumnLayout();
  const accountColumnLayout = useAccountingAccountColumnLayout();

  const {
    setAccounts,
    setEntries,
    setFiscalYears,
    handleDeleteEntry,
    handleRestoreEntry,
    handleBulkDeleteEntries,
    handleBulkRestoreEntries,
  } = useAccountingPageActions({ accounts, journalEntries, fiscalYears });

  useEffect(() => {
    if (activeSubTab === "journal" || activeSubTab === "coa") return;
    setFilteredCount(journalTotal);
  }, [activeSubTab, journalTotal]);

  const openJournalCreate = () => {
    setActiveTab("work");
    setActiveSubTab("journal");
    setCreateJournalRequestKey((key) => key + 1);
  };

  const openAccountCreate = () => {
    setActiveTab("work");
    setActiveSubTab("coa");
    setCreateAccountRequestKey((key) => key + 1);
  };

  const { handleShortcutStateChange } = useAccountingPageShortcuts({
    activeTab,
    activeSubTab,
    canWrite,
    showDeleted,
    openJournalCreate,
    journalList,
  });

  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.status === "active");
  const listLoadFailed =
    accountsResult.isError ||
    entriesResult.isError ||
    (aggregateSubTab && aggregateEntriesResult.isError);

  return {
    t,
    canWrite,
    canDelete,
    pageTabs,
    subTabs,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    showDeleted,
    setShowDeleted,
    createJournalRequestKey,
    createAccountRequestKey,
    accounts,
    journalEntries,
    aggregateEntries,
    fiscalYears,
    accountsResult,
    entriesResult,
    aggregateEntriesResult,
    journalTotal,
    filteredCount,
    setFilteredCount,
    settings,
    activeCurrency,
    activeFiscalYear,
    listLoadFailed,
    journalList,
    journalColumnLayout,
    accountColumnLayout,
    setAccounts,
    setEntries,
    setFiscalYears,
    handleDeleteEntry,
    handleRestoreEntry,
    handleBulkDeleteEntries,
    handleBulkRestoreEntries,
    handleShortcutStateChange,
    openJournalCreate,
    openAccountCreate,
  };
}
