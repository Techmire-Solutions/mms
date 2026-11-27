import React from "react";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import type { WorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { ACCOUNT_TYPES, type Account } from "../index";
import { useTranslation } from "@mms/fe-core/i18n";
import { ChartOfAccountsTypeCountsBar } from "../index";
import { AccountTypeGroup } from "./ChartOfAccountsTypeGroup";

export interface ChartOfAccountsListDesktopTableProps {
  accounts: Account[];
  filteredAccounts: Account[];
  /** Ids of accounts that carry sub-accounts (header/summary accounts). */
  summaryIds: ReadonlySet<string>;
  balanceConfig: Record<string, StatusBadgeConfigItem>;
  canWrite: boolean;
  isColumnVisible: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
  viewMode?: WorkDirectoryViewMode;
}

export function ChartOfAccountsListDesktopTable({
  accounts,
  filteredAccounts,
  summaryIds,
  balanceConfig,
  canWrite,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  onEdit,
  onDelete,
  onReactivate,
  viewMode,
}: ChartOfAccountsListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <ChartOfAccountsTypeCountsBar accounts={accounts} t={t} />

      {ACCOUNT_TYPES.map((type) => {
        const accountTypeRows = filteredAccounts.filter((account) => account.type === type);
        if (accountTypeRows.length === 0) return null;
        return (
          <AccountTypeGroup
            key={type}
            type={type}
            accountTypeRows={accountTypeRows}
            summaryIds={summaryIds}
            balanceConfig={balanceConfig}
            canWrite={canWrite}
            isColumnVisible={isColumnVisible}
            getColumnWidth={getColumnWidth}
            onColumnResize={onColumnResize}
            onEdit={onEdit}
            onDelete={onDelete}
            onReactivate={onReactivate}
            viewMode={viewMode}
          />
        );
      })}
    </>
  );
}
