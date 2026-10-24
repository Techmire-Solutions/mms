import React from "react";
import { Calendar, Lock, Pencil } from "lucide-react";
import { type FiscalYear, formatDate } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface AccountingFiscalYearsTableProps {
  sortedYears: FiscalYear[];
  fyStatusConfig: Record<string, StatusBadgeConfigItem>;
  canEditSetup: boolean;
  onEditFiscalYear: (fiscalYear: Partial<FiscalYear>) => void;
  onRequestCloseFiscalYear?: (fiscalYearId: string) => void;
  t: TranslationFunction;
}

export function AccountingFiscalYearsTable({
  sortedYears,
  fyStatusConfig,
  canEditSetup,
  onEditFiscalYear,
  onRequestCloseFiscalYear,
  t,
}: AccountingFiscalYearsTableProps): React.JSX.Element {
  const statusLabel = (fy: FiscalYear) => fyStatusConfig[fy.status]?.label ?? fy.status;

  const columns: DataTableColumn<FiscalYear>[] = [
    {
      id: "label",
      label: t("accounting.settings.fy.label"),
      fixed: true,
      render: (fy) => <span className="font-semibold text-foreground">{fy.label}</span>,
    },
    {
      id: "startDate",
      label: t("accounting.settings.fy.startDateField"),
      searchValue: (fy) => formatDate(fy.startDate),
      render: (fy) => <span className="text-muted-foreground">{formatDate(fy.startDate)}</span>,
    },
    {
      id: "endDate",
      label: t("accounting.settings.fy.endDateField"),
      searchValue: (fy) => formatDate(fy.endDate),
      render: (fy) => <span className="text-muted-foreground">{formatDate(fy.endDate)}</span>,
    },
    {
      id: "status",
      label: t("accounting.settings.fy.status"),
      searchValue: statusLabel,
      hideInCard: true,
      render: (fy) => <StatusBadge status={fy.status} config={fyStatusConfig} size="sm" />,
    },
  ];

  const filters: DataTableFilter<FiscalYear>[] = [
    {
      id: "status",
      label: t("accounting.settings.fy.status"),
      options: [...new Set(sortedYears.map((fy) => fy.status))].map((status) => ({
        value: status,
        label: fyStatusConfig[status]?.label ?? status,
      })),
      getValue: (fy) => fy.status,
    },
  ];

  return (
    <DataTable
      tableId="accounting.fiscalYears"
      label={t("accounting.settings.secFiscalYears")}
      data={sortedYears}
      columns={columns}
      filters={filters}
      actionsLabel={t("accounting.settings.fy.actions")}
      card={{
        title: (fy) => fy.label,
        badge: (fy) => <StatusBadge status={fy.status} config={fyStatusConfig} size="sm" />,
      }}
      renderRowActions={
        canEditSetup
          ? (fy) => (
              <DataTableRowActions
                actions={[
                  {
                    id: "close",
                    label: `${t("accounting.settings.fy.close")} ${fy.label}`,
                    icon: Lock,
                    hidden: !onRequestCloseFiscalYear || fy.status === "closed",
                    onClick: () => onRequestCloseFiscalYear?.(fy.id),
                  },
                  {
                    id: "edit",
                    label: `${t("common.edit")} ${fy.label}`,
                    icon: Pencil,
                    onClick: () => onEditFiscalYear(fy),
                  },
                ]}
              />
            )
          : undefined
      }
      emptyState={
        <EmptyState
          icon={Calendar}
          title={t("accounting.settings.noFiscalYears")}
          compact
          variant="dashed"
        />
      }
    />
  );
}
