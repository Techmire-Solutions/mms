import React from "react";
import {
  formatDate,
  type PlatformWorkspaceRow as PlatformWorkspaceRowData,
  type AppTranslationKey,
  type ModuleColumnKind,
} from "@mms/contracts";
import { tenantUrl } from "@/lib/config/tenantConfig";
import { useTranslation } from "@mms/fe-core/i18n";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { WorkBatchTable, type WorkBatchTableColumn } from "@mms/fe-core/components/WorkBatchTable";
import { toColumnResize, type DataTableColumnLayout } from "@mms/fe-core/components/data-table";
import { resolveVisibleDescriptorColumns } from "@/hooks/useDescriptorColumnLayout";
import {
  deriveSelectionState,
  WORK_TABLE_CONTAINER_CLASS,
} from "@mms/fe-core/components/workBatchTableTypes";
import { WorkspaceIdentityCell } from "@/platform/features/workspaces/components/WorkspaceIdentityCell";
import { WorkspaceRowActions } from "@/platform/features/workspaces/components/WorkspaceRowActions";
import {
  WorkspaceEnabledCell,
  WorkspaceEmailVerificationCell,
} from "@/platform/features/workspaces/components/WorkspaceTableSwitchCells";
import type {
  WorkspaceSortDirection,
  WorkspaceSortField,
} from "@/platform/features/workspaces/lib/platformWorkspaceListData";
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
  onOpenRename?: (workspace: PlatformWorkspaceRowData) => void;
  onInspect?: (workspace: PlatformWorkspaceRowData) => void;
  selectedSubdomains?: ReadonlySet<string>;
  onToggleSelect?: (subdomain: string) => void;
  onToggleSelectAll?: () => void;
}

const WORKSPACE_TABLE_ACTIONS_WIDTH = 288;

function resolveWorkspaceColumnSizing(columnId: string): {
  kind: ModuleColumnKind;
  width: number;
  widthClass: string;
} {
  if (columnId === "madrasaName") {
    return { kind: "identity", width: 300, widthClass: "w-75 min-w-72" };
  }
  if (columnId === "enabled") {
    return { kind: "status", width: 160, widthClass: "w-40 min-w-40" };
  }
  if (columnId === "requireEmailVerification") {
    return { kind: "boolean", width: 208, widthClass: "w-52 min-w-52" };
  }
  if (columnId === "createdAt") {
    return { kind: "date", width: 144, widthClass: "w-36 min-w-36" };
  }
  return { kind: "shortText", width: 160, widthClass: "w-40 min-w-40" };
}

function resolveWorkspaceSortField(columnId: string): WorkspaceSortField | undefined {
  if (columnId === "madrasaName") return "name";
  if (columnId === "enabled") return "status";
  if (columnId === "subdomain") return "subdomain";
  if (columnId === "createdAt") return "createdAt";
  return undefined;
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
  onOpenRename,
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

      const sizing = resolveWorkspaceColumnSizing(col.id);
      const headerClassName = cn(pad, sizing.widthClass);
      const cellClassName = cn(
        pad,
        "align-middle",
        sizing.widthClass,
        col.id === "createdAt" && cn("font-medium text-muted-foreground", textSz),
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
      const mappedSortField = f?.sortable === false ? undefined : resolveWorkspaceSortField(col.id);
      return {
        id: col.id,
        label,
        kind: sizing.kind,
        width: sizing.width,
        sortable: Boolean(mappedSortField),
        sortField: mappedSortField,
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
      actionsHeaderClassName={cn("w-72 min-w-72", pad)}
      actionsCellClassName={cn("w-72 min-w-72 overflow-hidden align-middle", pad)}
      actionsWidth={WORKSPACE_TABLE_ACTIONS_WIDTH}
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
          onOpenRename={onOpenRename ? () => onOpenRename(workspace) : undefined}
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
