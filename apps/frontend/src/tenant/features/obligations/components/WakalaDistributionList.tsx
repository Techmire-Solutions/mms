import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type ObligationDistribution } from "@/lib/data/obligationsData";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Account } from "@mms/shared";
import { useAccountingContractAccounts } from "@/tenant/hooks/collections/accounting";

interface WakalaDistributionListProps {
  distributions: ObligationDistribution[];
  distributionTypeConfig: Record<string, StatusBadgeConfigItem>;
  t: TranslationFunction;
  onEdit: (distribution: ObligationDistribution) => void;
  onDelete: (distributionId: string) => void;
  viewMode?: WorkDirectoryViewMode;
}

export function WakalaDistributionList({
  distributions,
  distributionTypeConfig,
  t,
  onEdit,
  onDelete,
  viewMode,
}: WakalaDistributionListProps): React.JSX.Element {
  const accountsQuery = useAccountingContractAccounts({});
  const accounts: Account[] | undefined =
    accountsQuery.data?.status === 200 ? accountsQuery.data.body.accounts : undefined;
  const accountMap = React.useMemo(
    () => new Map<string, Account>((accounts ?? []).map((account) => [account.id, account])),
    [accounts],
  );

  const columns: DataTableColumn<ObligationDistribution>[] = [
    {
      id: "name",
      label: t("obligations.wakala.colName"),
      fixed: true,
      render: (d) => <span className="font-medium text-foreground">{d.name}</span>,
    },
    {
      id: "type",
      label: t("obligations.wakala.colType"),
      searchValue: (d) => distributionTypeConfig[d.type]?.label ?? d.type,
      render: (d) => <StatusBadge status={d.type} config={distributionTypeConfig} size="sm" />,
    },
    {
      id: "account",
      label: t("obligations.wakala.colAccount"),
      render: (d) => {
        if (!d.account_id) {
          return (
            <span className="text-muted-foreground text-xs italic">
              {t("obligations.distribution.notMapped")}
            </span>
          );
        }
        const account = accountMap.get(d.account_id);
        return (
          <span className="text-xs font-mono font-medium text-foreground">
            {account ? `${account.code} · ${account.name}` : d.account_id}
          </span>
        );
      },
    },
    {
      id: "percentage",
      label: t("obligations.wakala.colPct"),
      render: (d) => (
        <span className="font-mono font-semibold text-foreground">{d.percentage}%</span>
      ),
    },
  ];

  const filters: DataTableFilter<ObligationDistribution>[] = [
    {
      id: "type",
      label: t("obligations.wakala.colType"),
      options: Object.entries(distributionTypeConfig).map(([value, item]) => ({
        value,
        label: item.label,
      })),
      getValue: (d) => d.type,
    },
  ];

  return (
    <DataTable
      tableId="obligations.wakalaDistributions"
      defaultViewMode={viewMode}
      label={t("obligations.wakala.distTableCaption")}
      data={distributions}
      columns={columns}
      filters={filters}
      actionsLabel={t("obligations.wakala.colActions")}
      card={{ title: (d) => d.name }}
      renderRowActions={(d) => (
        <DataTableRowActions
          actions={[
            {
              id: "edit",
              label: t("obligations.wakala.distEditAria", { name: d.name }),
              icon: Pencil,
              onClick: () => onEdit(d),
            },
            {
              id: "delete",
              label: t("obligations.wakala.distDeleteAria", { name: d.name }),
              icon: Trash2,
              tone: "destructive",
              onClick: () => onDelete(d.id),
            },
          ]}
        />
      )}
    />
  );
}
