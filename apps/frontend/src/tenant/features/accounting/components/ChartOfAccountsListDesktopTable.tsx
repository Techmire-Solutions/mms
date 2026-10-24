import React from "react";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { ACCOUNT_TYPES, type Account } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { ChartOfAccountsTypeCountsBar } from "@/tenant/features/accounting/components/ChartOfAccountsTypeCountsBar";
import { AccountTypeGroup } from "@/tenant/features/accounting/components/ChartOfAccountsTypeGroup";

export interface ChartOfAccountsListDesktopTableProps {
  accounts: Account[];
  filteredAccounts: Account[];
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
