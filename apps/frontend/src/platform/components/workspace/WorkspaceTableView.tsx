import React from "react";
import {
  formatDate,
  type PlatformWorkspaceRow as PlatformWorkspaceRowData,
  type AppTranslationKey,
} from "@mms/shared";
import { tenantUrl } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import type { EntityDescriptor } from "@/types/entityRegistry";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { toColumnResize, type DataTableColumnLayout } from "@/components/common/data-table";
import { resolveVisibleDescriptorColumns } from "@/hooks/useDescriptorColumnLayout";
import {
  deriveSelectionState,
  WORK_TABLE_CONTAINER_CLASS,
} from "@/components/common/work/workBatchTableTypes";
import { WorkspaceIdentityCell } from "@/platform/components/workspace/WorkspaceIdentityCell";
import { WorkspaceRowActions } from "@/platform/components/workspace/WorkspaceRowActions";
import {
  WorkspaceEnabledCell,
  WorkspaceEmailVerificationCell,
} from "@/platform/components/workspace/WorkspaceTableSwitchCells";
import type {
  WorkspaceSortDirection,
  WorkspaceSortField,
} from "@/platform/components/platformWorkspaceListData";
import { cn } from "@/lib/utils";
import type { PlatformDensity } from "@/platform/hooks/usePlatformDensity";

export interface WorkspaceTableViewProps {
  workspaces: PlatformWorkspaceRowData[];
  descriptor: EntityDescriptor<PlatformWorkspaceRowData>;
  columnLayout?: DataTableColumnLayout;
  appDomain: string;
  density?: PlatformDensity;
  sortField: WorkspaceSortField;
  sortDirection: WorkspaceSortDirection;
  onToggleSort: (field: WorkspaceSortField) => void;
  togglePending: boolean;
  deletePending: boolean;
  targetWorkspaceSubdomain?: string;
  onToggleEnabled: (subdomain: string, enabled: boolean) => void;
  onToggleEmailVerification: (subdomain: string, required: boolean) => void;
  onOpenModules: (workspace: PlatformWorkspaceRowData) => void;
  onOpenDelete?: (workspace: PlatformWorkspaceRowData) => void;
  onOpenResetPassword?: (workspace: PlatformWorkspaceRowData) => void;
  onOpenCreateAdmin?: (workspace: PlatformWorkspaceRowData) => void;
  onInspect?: (workspace: PlatformWorkspaceRowData) => void;
  selectedSubdomains?: ReadonlySet<string>;
  onToggleSelect?: (subdomain: string) => void;
  onToggleSelectAll?: () => void;
}

type WorkspaceTableRow = PlatformWorkspaceRowData & { id: string };

export function WorkspaceTableView({
  workspaces,
  descriptor,
  columnLayout,
  appDomain,
  density = "standard",
  sortField,
  sortDirection,
  onToggleSort,
  togglePending,
  deletePending,
  targetWorkspaceSubdomain,
  onToggleEnabled,
  onToggleEmailVerification,
  onOpenModules,
  onOpenDelete,
  onOpenResetPassword,
  onOpenCreateAdmin,
  onInspect,
  selectedSubdomains,
  onToggleSelect,
  onToggleSelectAll,
}: WorkspaceTableViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const busy = togglePending || deletePending;
  const pad =
    density === "compact"
      ? "px-3 py-1.5"
      : density === "comfortable"
        ? "px-4 py-3.5"
        : "px-4 py-2.5";
  const textSz =
    density === "compact" ? "text-2xs" : density === "comfortable" ? "text-sm" : "text-xs";

  const rows: WorkspaceTableRow[] = React.useMemo(
    () => workspaces.map((w) => ({ ...w, id: w.subdomain })),
    [workspaces],
  );

  const columns: WorkBatchTableColumn<WorkspaceTableRow>[] = React.useMemo(() => {
    return resolveVisibleDescriptorColumns(
      descriptor.getTableColumns(),
      columnLayout?.columnRegistry,
    ).map((col) => {
      const f = descriptor.getField(col.id);
      const labelKey = f?.labelKey as AppTranslationKey | undefined;
      const translated = labelKey ? t(labelKey) : undefined;
      const label =
        translated && translated !== labelKey ? translated : col.label || f?.label || col.id;

      const headerClassName = cn(
        pad,
        col.id === "madrasaName"
          ? "min-w-72 flex-1"
          : col.id === "enabled"
            ? "w-44 min-w-44"
            : col.id === "requireEmailVerification"
              ? "w-60 min-w-60"
              : col.id === "createdAt"
                ? "w-40 min-w-40"
                : "w-36",
      );

      const cellClassName = cn(
        pad,
        "align-middle",
        col.id === "madrasaName"
          ? "min-w-72"
          : col.id === "enabled"
            ? "w-44 min-w-44"
            : col.id === "requireEmailVerification"
              ? "w-60 min-w-60"
              : col.id === "createdAt"
                ? cn("font-medium text-muted-foreground w-40 min-w-40", textSz)
                : "",
      );

      const render = (workspace: WorkspaceTableRow) => {
        if (col.id === "madrasaName") {
          return <WorkspaceIdentityCell workspace={workspace} appDomain={appDomain} />;
        }
        if (col.id === "enabled") {
          return (
            <WorkspaceEnabledCell
              workspace={workspace}
              busy={busy}
              onToggleEnabled={onToggleEnabled}
            />
          );
        }
        if (col.id === "requireEmailVerification") {
          return (
            <WorkspaceEmailVerificationCell
              workspace={workspace}
              busy={busy}
              onToggleEmailVerification={onToggleEmailVerification}
            />
          );
        }
        if (col.id === "createdAt") return formatDate(workspace.createdAt);
        return String(Reflect.get(workspace, col.id) ?? "—");
      };

      const noWrap =
        col.id === "createdAt" || col.id === "enabled" || col.id === "requireEmailVerification";
      return {
        id: col.id,
        label,
        sortField: col.id,
        headerClassName,
        cellClassName,
        noWrap,
        render,
      };
    });
  }, [
    descriptor,
    columnLayout,
    t,
    appDomain,
    busy,
    onToggleEnabled,
    onToggleEmailVerification,
    pad,
    textSz,
  ]);

  return (
    <WorkBatchTable
      data={rows}
      columns={columns}
      sort={{
        field: sortField,
        dir: sortDirection,
        onSort: (f) => onToggleSort(f as WorkspaceSortField),
      }}
      selection={
        onToggleSelect && selectedSubdomains && onToggleSelectAll
          ? {
              selectedIds: selectedSubdomains,
              onSelectOne: (id) => onToggleSelect(id),
              onSelectAll: onToggleSelectAll,
              ...deriveSelectionState(
                workspaces.map((w) => ({ ...w, id: w.subdomain })),
                selectedSubdomains,
              ),
              selectAllAriaLabel: t("platform.workspaces.selectAll"),
              selectRowAriaLabel: (w) =>
                t("platform.workspaces.selectItem", { name: w.madrasaName }),
            }
          : undefined
      }
      onRowClick={onInspect ? (w) => onInspect(w) : undefined}
      stickyColumnId="madrasaName"
      columnResize={toColumnResize(columnLayout)}
      actionsLabel={t("common.actions")}
      actionsHeaderClassName={cn("w-56 min-w-56 text-end", pad)}
      actionsCellClassName={cn("w-56 min-w-56 text-end align-middle", pad)}
      renderRowActions={(workspace) => (
        <WorkspaceRowActions
          subdomain={workspace.subdomain}
          enabled={workspace.enabled}
          requireEmailVerification={workspace.requireEmailVerification}
          busy={busy}
          deletePending={deletePending && targetWorkspaceSubdomain === workspace.subdomain}
          tenantLink={tenantUrl(workspace.subdomain, "/")}
          variant="table"
          onToggle={(enabled) => onToggleEnabled(workspace.subdomain, enabled)}
          onToggleEmailVerification={(req) => onToggleEmailVerification(workspace.subdomain, req)}
          onOpenModules={() => onOpenModules(workspace)}
          onOpenDelete={onOpenDelete ? () => onOpenDelete(workspace) : undefined}
          onOpenResetPassword={
            onOpenResetPassword ? () => onOpenResetPassword(workspace) : undefined
          }
          onOpenCreateAdmin={onOpenCreateAdmin ? () => onOpenCreateAdmin(workspace) : undefined}
        />
      )}
      rowClassName={(workspace) =>
        cn(
          "group hover:bg-muted/30 transition-colors scroll-mt-20",
          onInspect &&
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
          !workspace.enabled && "opacity-85 hover:opacity-100",
          deletePending &&
            targetWorkspaceSubdomain === workspace.subdomain &&
            "opacity-40 pointer-events-none",
        )
      }
      containerClassName={WORK_TABLE_CONTAINER_CLASS}
      virtualize={workspaces.length > 10}
      estimateRowSize={density === "compact" ? 38 : density === "comfortable" ? 64 : 48}
    />
  );
}
