import { Pencil, Trash2 } from "lucide-react";
import { type ObligationType } from "@/lib/data/obligationsData";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

interface ObligationTypeManagerListProps {
  types: ObligationType[];
  designatedConfig: Record<string, StatusBadgeConfigItem>;
  quantityConfig: Record<string, StatusBadgeConfigItem>;
  onEdit: (obligationType: ObligationType) => void;
  onDelete: (obligationTypeId: string) => void;
  viewMode?: WorkDirectoryViewMode;
}

const toOptions = (config: Record<string, StatusBadgeConfigItem>) =>
  Object.entries(config).map(([value, item]) => ({ value, label: item.label }));

export function ObligationTypeManagerList({
  types,
  designatedConfig,
  quantityConfig,
  onEdit,
  onDelete,
  viewMode,
}: ObligationTypeManagerListProps) {
  const { t } = useTranslation();
  const quantityKey = (type: ObligationType) => (type.quantity_based ? "yes" : "no");

  const columns: DataTableColumn<ObligationType>[] = [
    {
      id: "name",
      label: t("obligations.types.colName"),
      fixed: true,
      render: (type) => <span className="font-semibold text-foreground">{type.name}</span>,
    },
    {
      id: "quantity",
      label: t("obligations.types.colQuantity"),
      searchValue: (type) => quantityConfig[quantityKey(type)]?.label,
      render: (type) => (
        <StatusBadge status={quantityKey(type)} config={quantityConfig} size="sm" />
      ),
    },
    {
      id: "designated",
      label: t("obligations.types.colDesignated"),
      searchValue: (type) => designatedConfig[type.designated_for]?.label ?? type.designated_for,
      render: (type) => (
        <StatusBadge status={type.designated_for} config={designatedConfig} size="sm" />
      ),
    },
  ];

  const filters: DataTableFilter<ObligationType>[] = [
    {
      id: "quantity",
      label: t("obligations.types.colQuantity"),
      options: toOptions(quantityConfig),
      getValue: quantityKey,
    },
    {
      id: "designated",
      label: t("obligations.types.colDesignated"),
      options: toOptions(designatedConfig),
      getValue: (type) => type.designated_for,
    },
  ];

  return (
    <section aria-label={t("obligations.types")}>
      <DataTable
        tableId="obligations.types"
        defaultViewMode={viewMode}
        label={t("obligations.types")}
        data={types}
        columns={columns}
        filters={filters}
        card={{ title: (type) => type.name }}
        renderRowActions={(type) => (
          <DataTableRowActions
            actions={[
              {
                id: "edit",
                label: t("obligations.types.editAria", { name: type.name }),
                icon: Pencil,
                onClick: () => onEdit(type),
              },
              {
                id: "delete",
                label: t("obligations.types.deleteAria", { name: type.name }),
                icon: Trash2,
                tone: "destructive",
                onClick: () => onDelete(type.id),
              },
            ]}
          />
        )}
        emptyState={<EmptyState title={t("obligations.types.empty")} compact variant="dashed" />}
      />
    </section>
  );
}
