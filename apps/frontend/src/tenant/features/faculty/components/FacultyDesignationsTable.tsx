import React, { useMemo } from "react";
import { Award, Pencil, Trash2 } from "lucide-react";
import type { FacultyDesignationDefinition } from "@mms/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyDesignationsTableProps {
  designations: FacultyDesignationDefinition[];
  editingDesignationId?: string;
  isPending: boolean;
  isLoading?: boolean;
  canWrite?: boolean;
  onEdit: (designation: FacultyDesignationDefinition) => void;
  onDelete: (designation: FacultyDesignationDefinition) => void;
  primaryAction?: React.ReactNode;
}

const Dash = () => <span className="text-muted-foreground/50">—</span>;

/** Designations directory — Faculty Management model: department, name, parent, status. */
export function FacultyDesignationsTable({
  designations,
  editingDesignationId,
  isPending,
  isLoading = false,
  canWrite = true,
  onEdit,
  onDelete,
  primaryAction,
}: FacultyDesignationsTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = (d: FacultyDesignationDefinition) => t(`faculty.status.${d.status}`);
  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    active: { label: t("faculty.status.active"), cls: SEMANTIC_BADGE.success },
    inactive: { label: t("faculty.status.inactive"), cls: SEMANTIC_BADGE.muted },
  };

  const columns: DataTableColumn<FacultyDesignationDefinition>[] = [
    {
      id: "name",
      label: t("faculty.designations.name"),
      fixed: true,
      render: (d) => (
        <span
          className="font-medium"
          style={{ paddingInlineStart: `${Math.max(0, (d.hierarchyRank ?? 1) - 1) * 0.75}rem` }}
        >
          {d.name}
        </span>
      ),
    },
    {
      id: "department",
      label: t("faculty.designations.department"),
      searchValue: (d) => d.departmentName ?? "",
      render: (d) => (
        <span className="text-xs text-muted-foreground">{d.departmentName ?? <Dash />}</span>
      ),
    },
    {
      id: "parent",
      label: t("faculty.designations.parentDesignation"),
      searchValue: (d) => d.parentDesignationName ?? "",
      render: (d) => (
        <span className="text-xs text-muted-foreground">{d.parentDesignationName ?? <Dash />}</span>
      ),
    },
    {
      id: "status",
      label: t("common.status"),
      width: 120,
      searchValue: statusLabel,
      render: (d) => <StatusBadge status={d.status} config={statusConfig} size="sm" />,
    },
  ];

  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of designations)
      if (d.departmentId && !seen.has(d.departmentId))
        seen.set(d.departmentId, d.departmentName ?? d.departmentId);
    return [...seen]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [designations]);

  const filters: DataTableFilter<FacultyDesignationDefinition>[] = [
    {
      id: "department",
      label: t("faculty.designations.department"),
      options: departmentOptions,
      getValue: (d) => d.departmentId,
    },
    {
      id: "status",
      label: t("common.status"),
      options: [
        { value: "active", label: t("faculty.status.active") },
        { value: "inactive", label: t("faculty.status.inactive") },
      ],
      getValue: (d) => d.status,
    },
  ];

  return (
    <DataTable
      tableId="faculty.designations"
      label={t("faculty.tabs.designations")}
      data={designations}
      columns={columns}
      filters={filters}
      isLoading={isLoading}
      searchPlaceholder={t("faculty.designations.searchPlaceholder")}
      primaryAction={primaryAction}
      card={{
        title: (d) => d.name,
        badge: (d) => <StatusBadge status={d.status} config={statusConfig} size="sm" />,
      }}
      rowClassName={(d) =>
        d.id === editingDesignationId
          ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
          : d.status === "active"
            ? undefined
            : "opacity-70"
      }
      renderRowActions={
        canWrite
          ? (d) => (
              <DataTableRowActions
                actions={[
                  {
                    id: "edit",
                    label: `${t("common.edit")} ${d.name}`,
                    icon: Pencil,
                    onClick: () => onEdit(d),
                    disabled: isPending,
                  },
                  {
                    id: "delete",
                    label: `${t("common.delete")} ${d.name}`,
                    icon: Trash2,
                    tone: "destructive",
                    onClick: () => onDelete(d),
                    disabled: isPending,
                  },
                ]}
              />
            )
          : undefined
      }
      emptyState={
        <EmptyState
          icon={Award}
          title={t("faculty.designations.emptyCatalog")}
          description={t("faculty.designations.setupHint")}
          compact
          variant="dashed"
        />
      }
    />
  );
}
