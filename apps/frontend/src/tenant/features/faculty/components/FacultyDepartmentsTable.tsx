import React from "react";
import { Building2, Pencil, Trash2 } from "lucide-react";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyDepartmentsTableProps {
  departments: FacultyDepartmentEntity[];
  editingDepartmentId?: string;
  isPending: boolean;
  isLoading: boolean;
  canWrite?: boolean;
  onEdit: (dept: FacultyDepartmentEntity) => void;
  onDelete: (dept: FacultyDepartmentEntity) => void;
}

const Dash = () => <span className="text-muted-foreground/50">—</span>;

/** Departments directory — Faculty Management model: name, description, designation count, status. */
export function FacultyDepartmentsTable({
  departments,
  editingDepartmentId,
  isPending,
  isLoading,
  canWrite = true,
  onEdit,
  onDelete,
}: FacultyDepartmentsTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = (d: FacultyDepartmentEntity) => t(`faculty.status.${d.status}`);
  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    active: { label: t("faculty.status.active"), cls: SEMANTIC_BADGE.success },
    inactive: { label: t("faculty.status.inactive"), cls: SEMANTIC_BADGE.muted },
  };

  const columns: DataTableColumn<FacultyDepartmentEntity>[] = [
    {
      id: "name",
      label: t("faculty.setup.departmentName"),
      fixed: true,
      render: (d) => <span className="truncate font-medium">{d.name}</span>,
    },
    {
      id: "description",
      label: t("faculty.setup.departmentDescription"),
      searchValue: (d) => d.description ?? "",
      render: (d) => (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {d.description?.trim() ? d.description : <Dash />}
        </span>
      ),
    },
    {
      id: "designationCount",
      label: t("faculty.setup.departmentDesignationCount"),
      width: 130,
      cellClassName: "text-end",
      render: (d) => <span className="tabular-nums">{d.designationCount ?? 0}</span>,
    },
    {
      id: "status",
      label: t("common.status"),
      width: 120,
      searchValue: statusLabel,
      render: (d) => <StatusBadge status={d.status} config={statusConfig} size="sm" />,
    },
  ];

  const filters: DataTableFilter<FacultyDepartmentEntity>[] = [
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
      tableId="faculty.departments"
      label={t("faculty.tabs.departments")}
      data={departments}
      columns={columns}
      filters={filters}
      isLoading={isLoading}
      searchPlaceholder={t("faculty.setup.searchDepartments")}
      card={{
        title: (d) => d.name,
        badge: (d) => <StatusBadge status={d.status} config={statusConfig} size="sm" />,
      }}
      rowClassName={(d) =>
        d.id === editingDepartmentId
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
          icon={Building2}
          title={t("faculty.setup.noDepartments")}
          description={t("faculty.setup.departmentsHint")}
          compact
          variant="dashed"
        />
      }
    />
  );
}
