import React, { useMemo } from "react";
import { type AppTranslationKey } from "@mms/shared";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";
import { type StatusBadgeConfigItem, StatusBadge } from "@/components/ui/StatusBadge";
import { EntityCardsGrid } from "@/components/ui/EntityCardsGrid";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import { ACCOUNT_TYPE_META, type Account, type AccountType } from "@/lib/data/accountingData";
import {
  AccountMobileCard,
  AccountRowActions,
} from "@/tenant/features/accounting/components/ChartOfAccountsTreeRows";

export interface AccountTypeGroupProps {
  type: AccountType;
  accountTypeRows: Account[];
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

export function AccountTypeGroup({
  type,
  accountTypeRows,
  balanceConfig,
  canWrite,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  onEdit,
  onDelete,
  onReactivate,
  viewMode: propViewMode,
}: AccountTypeGroupProps): React.JSX.Element {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  const batchColumns = useMemo<WorkBatchTableColumn<Account>[]>(() => {
    const cols: WorkBatchTableColumn<Account>[] = [];

    if (isColumnVisible("code")) {
      cols.push({
        id: "code",
        label: t("accounting.columns.account.code"),
        width: getColumnWidth?.("code"),
        cellClassName: "font-mono text-xs font-bold text-muted-foreground",
        render: (account) => account.code,
      });
    }

    if (isColumnVisible("name")) {
      cols.push({
        id: "name",
        label: t("accounting.columns.account.name"),
        width: getColumnWidth?.("name"),
        render: (account) => (
          <>
            <span className="font-semibold text-foreground">{account.name}</span>
            {account.isActive === false && (
              <Badge as="span" pill tone="muted" className="ms-2 px-1.5">
                {t("accounting.coa.inactive")}
              </Badge>
            )}
          </>
        ),
      });
    }

    if (isColumnVisible("type")) {
      cols.push({
        id: "type",
        label: t("accounting.columns.account.type"),
        width: getColumnWidth?.("type"),
        headerClassName: "hidden sm:table-cell",
        cellClassName: "hidden text-xs text-muted-foreground sm:table-cell",
        render: (account) => t(`accounting.type.${account.type}` as AppTranslationKey),
      });
    }

    if (isColumnVisible("subtype")) {
      cols.push({
        id: "subtype",
        label: t("accounting.columns.account.subtype"),
        width: getColumnWidth?.("subtype"),
        headerClassName: "hidden md:table-cell",
        cellClassName: "hidden text-xs text-muted-foreground md:table-cell",
        render: (account) => account.subtype || "—",
      });
    }

    if (isColumnVisible("description")) {
      cols.push({
        id: "description",
        label: t("accounting.columns.account.description"),
        width: getColumnWidth?.("description"),
        headerClassName: "hidden lg:table-cell",
        cellClassName:
          "hidden max-w-cell-trunc truncate text-xs text-muted-foreground lg:table-cell",
        render: (account) => account.description || "—",
      });
    }

    if (isColumnVisible("normalBalance")) {
      cols.push({
        id: "normalBalance",
        label: t("accounting.columns.account.normalBalance"),
        width: getColumnWidth?.("normalBalance"),
        render: (account) => (
          <StatusBadge
            status={ACCOUNT_TYPE_META[account.type]?.normalBalance === "debit" ? "debit" : "credit"}
            config={balanceConfig}
            size="sm"
          />
        ),
      });
    }

    return cols;
  }, [isColumnVisible, t, getColumnWidth, balanceConfig]);

  return (
    <article className={`${WORK_SURFACE} overflow-hidden`}>
      <header
        className={`px-4 py-2.5 border-b border-border ${ACCOUNT_TYPE_META[type]?.color} flex min-w-0 items-center justify-between gap-2`}
      >
        <SectionLabel
          as="h3"
          weight="bold"
          tracking="wide"
          tone="inherit"
          className="min-w-0 truncate m-0"
        >
          <span aria-hidden="true">{ACCOUNT_TYPE_META[type]?.icon}</span>{" "}
          {t("accounting.coa.groupHeader", {
            type: t(`accounting.type.${type}` as AppTranslationKey),
            group: t(
              `accounting.reports.views.${ACCOUNT_TYPE_META[type]?.group}` as AppTranslationKey,
            ),
          })}
        </SectionLabel>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {t("accounting.coa.groupMeta", {
            normal:
              ACCOUNT_TYPE_META[type]?.normalBalance === "debit"
                ? t("accounting.ledger.dr")
                : t("accounting.ledger.cr"),
            count: accountTypeRows.length,
          })}
        </span>
      </header>
      {viewMode === "cards" ? (
        <div className="p-3">
          <EntityCardsGrid>
            {accountTypeRows.map((account) => (
              <AccountMobileCard
                key={account.id}
                account={account}
                balanceConfig={balanceConfig}
                canWrite={canWrite}
                isColumnVisible={isColumnVisible}
                onEdit={onEdit}
                onDelete={onDelete}
                onReactivate={onReactivate}
              />
            ))}
          </EntityCardsGrid>
        </div>
      ) : (
        <WorkBatchTable
          data={accountTypeRows}
          columns={batchColumns}
          columnResize={{
            getColumnWidth,
            onColumnResize,
          }}
          actionsLabel={t("accounting.columns.actions")}
          rowClassName={(account) => (account.isActive === false ? "opacity-50" : "")}
          renderRowActions={(account) => (
            <div className="flex items-center justify-end gap-1">
              {canWrite && (
                <AccountRowActions
                  account={account}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReactivate={onReactivate}
                />
              )}
            </div>
          )}
        />
      )}
    </article>
  );
}
