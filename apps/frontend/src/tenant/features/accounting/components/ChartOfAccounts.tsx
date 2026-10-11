import React, { useState, useEffect, useDeferredValue } from "react";
import { Landmark } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ACCOUNT_TYPE_META, type Account, type AccountType } from "@/lib/data/accountingData";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { ChartOfAccountsListFilters } from "@/tenant/features/accounting/components/ChartOfAccountsListFilters";
import { ChartOfAccountsListDesktopTable } from "@/tenant/features/accounting/components/ChartOfAccountsListDesktopTable";
import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import { useTranslation } from "@/hooks/useTranslation";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { type AppTranslationKey } from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { ChartOfAccountsSeedEmptyState } from "@/tenant/features/accounting/components/ChartOfAccountsSeedEmptyState";

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

interface ChartOfAccountsProps {
  accounts: Account[];
  /** False while the account list is still loading — suppresses the "no chart yet" state. */
  accountsLoaded?: boolean;
  onChange: (accounts: Account[] | ((prev: Account[]) => Account[])) => void | Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  createRequestKey?: number;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  viewMode?: WorkDirectoryViewMode;
}

/**
 * ChartOfAccounts component.
 *
 * Displays and manages the Chart of Accounts.
 *
 * @param {ChartOfAccountsProps} props - The component props.
 * @returns {React.ReactElement}
 */
export function ChartOfAccounts({
  accounts,
  accountsLoaded = true,
  onChange,
  onFilteredCountChange,
  canWrite = true,
  createRequestKey = 0,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
  viewMode,
}: ChartOfAccountsProps) {
  const { t } = useTranslation();
  const directoryView = useWorkDirectoryViewMode(viewMode);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<Partial<Account> | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Account | null>(null);
  const balanceConfig = (() => ({
    debit: { label: t("accounting.ledger.dr"), cls: SEMANTIC_BADGE.infoStrong },
    credit: { label: t("accounting.ledger.cr"), cls: SEMANTIC_BADGE.successStrong },
  }))() as Record<string, StatusBadgeConfigItem>;

  const filtered = (() =>
    accounts
      .filter((account) => typeFilter === "all" || account.type === typeFilter)
      .filter((account) => showInactive || account.isActive !== false)
      .filter(
        (account) =>
          !deferredSearch ||
          account.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
          account.code.includes(deferredSearch),
      )
      .sort((firstAccount, secondAccount) =>
        firstAccount.code.localeCompare(secondAccount.code),
      ))();

  useEffect(() => {
    onFilteredCountChange?.(filtered.length);
  }, [filtered.length, onFilteredCountChange]);

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;

  const handleSave = async (account: Account) => {
    await onChange((prev) => {
      if (account.id && prev.find((existingAccount) => existingAccount.id === account.id)) {
        return prev.map((existingAccount) =>
          existingAccount.id === account.id ? account : existingAccount,
        );
      }
      return [...prev, { ...account, isActive: true }];
    });
    setModal(null);
  };

  const handleDelete = async (id: string) => {
    await onChange((prev) =>
      prev.map((account) => (account.id === id ? { ...account, isActive: false } : account)),
    );
    setPendingDeactivate(null);
  };

  const handleReactivate = async (id: string) => {
    await onChange((prev) =>
      prev.map((account) => (account.id === id ? { ...account, isActive: true } : account)),
    );
  };

  const existingCodes = accounts.map((account) => account.code);
  const openAddAccount = () =>
    setModal({
      id: "",
      code: "",
      name: "",
      type: "Asset",
      subtype: "",
      description: "",
      isActive: true,
    });

  useEffect(() => {
    if (createRequestKey > 0 && canWrite) {
      openAddAccount();
    }
  }, [createRequestKey, canWrite]);

  const exportCSV = () => {
    runGridCsvExportJob({
      moduleId: "accounting",
      label: t("accounting.coa.exportLabel"),
      filename: "chart_of_accounts.csv",
      columns: [
        { header: t("accounting.columns.account.code"), key: "code" },
        { header: t("accounting.columns.account.name"), key: "name" },
        { header: t("accounting.columns.account.type"), key: "type" },
        { header: t("accounting.columns.account.subtype"), key: "subtype" },
        { header: t("accounting.columns.account.normalBalance"), key: "normalBalance" },
        { header: t("accounting.columns.account.description"), key: "description" },
        { header: t("accounting.columns.account.active"), key: "active" },
      ],
      rows: filtered.map((account) => ({
        code: account.code,
        name: account.name,
        type: t(`accounting.type.${account.type}` as AppTranslationKey),
        subtype: account.subtype || "",
        normalBalance:
          ACCOUNT_TYPE_META[account.type]?.normalBalance === "debit"
            ? t("accounting.ledger.dr")
            : t("accounting.ledger.cr"),
        description: account.description || "",
        active: account.isActive !== false ? t("common.yes") : t("common.no"),
      })),
    });
  };

  return (
    <section aria-label={t("accounting.coa.aria")} className="space-y-4">
      <ChartOfAccountsListFilters
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        showInactive={showInactive}
        setShowInactive={setShowInactive}
        onExportCsv={exportCSV}
        onAddAccount={openAddAccount}
        canWrite={canWrite}
        columnCustomizer={columnCustomizer}
        viewMode={directoryView.viewMode}
        onViewModeChange={directoryView.setViewMode}
      />

      {accountsLoaded && accounts.length === 0 ? (
        <ChartOfAccountsSeedEmptyState canWrite={canWrite} onAddAccount={openAddAccount} />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={Landmark}
          title={t("accounting.coa.noAccountsMatch")}
          description={t("accounting.coa.noAccountsHint")}
          action={
            search || typeFilter !== "all" || showInactive ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setShowInactive(false);
                }}
              >
                {t("common.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ChartOfAccountsListDesktopTable
          accounts={accounts}
          filteredAccounts={filtered}
          balanceConfig={balanceConfig}
          canWrite={canWrite}
          isColumnVisible={columnVisible}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
          onEdit={(account) => setModal({ ...account })}
          onDelete={(id) =>
            setPendingDeactivate(accounts.find((account) => account.id === id) ?? null)
          }
          onReactivate={handleReactivate}
          viewMode={directoryView.viewMode}
        />
      )}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("accounting.coa.accountsShown", { count: filtered.length })}
      </p>

      <AnimatePresence>
        {canWrite && modal !== null && (
          <AccountModal
            initial={modal as Account}
            onSave={handleSave}
            onClose={() => setModal(null)}
            existingCodes={existingCodes}
          />
        )}
      </AnimatePresence>
      <ConfirmAlertDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null);
        }}
        title={t("accounting.coa.deactivate")}
        description={t("accounting.coa.deactivateConfirm")}
        confirmLabel={t("accounting.coa.deactivate")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => (pendingDeactivate ? handleDelete(pendingDeactivate.id) : undefined)}
      />
    </section>
  );
}
