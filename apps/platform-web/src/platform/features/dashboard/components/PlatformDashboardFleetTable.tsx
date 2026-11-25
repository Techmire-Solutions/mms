import React, { useMemo } from "react";
import { Building2 } from "lucide-react";
import type { PlatformWorkspaceRow } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { BiDiText } from "@mms/ui/app/BiDiText";
import { usePlatformInspector } from "@/platform/features/shell/lib/PlatformInspectorContext";
import { EmptyState, ListPagination } from "@mms/ui";
import { WorkBatchTable, type WorkBatchTableColumn } from "@mms/fe-core/components/WorkBatchTable";
import { WorkspaceStatusBadge } from "@/platform/features/workspaces/components/WorkspaceStatusBadge";
import { PlatformDashboardFleetRowMenu } from "@/platform/features/dashboard/components/PlatformDashboardFleetRowMenu";

export interface PlatformDashboardFleetTableProps {
  rows: PlatformWorkspaceRow[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  selected: ReadonlySet<string>;
  onToggleSelect: (subdomain: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onPageChange: (page: number) => void;
  sortDir: "asc" | "desc";
  onToggleSort: () => void;
}

type FleetRow = PlatformWorkspaceRow & { id: string };

/** Zone D–F — sortable selectable table with row menu, pagination, empty/loading. */
export function PlatformDashboardFleetTable({
  rows,
  total,
  page,
  pageSize,
  isLoading,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onPageChange,
  sortDir,
  onToggleSort,
}: PlatformDashboardFleetTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const { openInspector } = usePlatformInspector();

  const data: FleetRow[] = useMemo(() => rows.map((r) => ({ ...r, id: r.subdomain })), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.subdomain));

  const columns: WorkBatchTableColumn<FleetRow>[] = useMemo(
    () => [
      {
        id: "name",
        kind: "identity",
        label: t("platform.sort.name"),
        sortField: "name",
        render: (row) => (
          <div className="min-w-0">
            <BiDiText
              as="p"
              className="text-sm font-bold text-foreground truncate"
              titleFromContent
            >
              {row.madrasaName}
            </BiDiText>
            <p className="text-3xs font-mono text-muted-foreground">{row.subdomain}</p>
          </div>
        ),
      },
      {
        id: "status",
        kind: "status",
        label: t("platform.workspaceActive"),
        render: (row) => <WorkspaceStatusBadge enabled={row.enabled} />,
      },
    ],
    [t],
  );

  const empty = (
    <EmptyState
      icon={Building2}
      title={t("platform.fleetEmptyTitle")}
      description={t("platform.fleetEmptyHint")}
    />
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
      <span />
      <ListPagination
        page={page}
        total={total}
        limit={pageSize}
        onPageChange={onPageChange}
        labels={{
          previous: t("platform.pagination.previous"),
          next: t("platform.pagination.next"),
          range: (from, to, tot) => t("platform.pagination.range", { from, to, total: tot }),
          pageOf: (p, tp) => t("platform.pagination.pageOf", { page: p, totalPages: tp }),
          label: t("platform.pagination.label"),
        }}
      />
    </div>
  );

  return (
    <div className="overflow-hidden" data-testid="dashboard-fleet-table">
      <WorkBatchTable<FleetRow>
        data={data}
        columns={columns}
        isLoading={isLoading}
        emptyState={empty}
        caption={t("platform.fleetDirectory")}
        sort={{
          field: "name",
          dir: sortDir,
          onSort: () => onToggleSort(),
        }}
        selection={{
          selectedIds: selected,
          onSelectOne: (id) => onToggleSelect(String(id)),
          onSelectAll: () => onToggleSelectAll(!allSelected),
          allSelected,
          someSelected: selected.size > 0 && !allSelected,
          selectAllAriaLabel: t("platform.workspaces.selectAll"),
          selectRowAriaLabel: (row) =>
            t("platform.workspaces.selectItem", { name: row.madrasaName }),
        }}
        renderRowActions={(row) => <PlatformDashboardFleetRowMenu row={row} />}
        onRowClick={(row) =>
          openInspector({
            kind: "workspace",
            subdomain: row.subdomain,
            madrasaName: row.madrasaName,
            enabled: row.enabled,
            createdAt: row.createdAt,
            adminEmail: row.adminEmail,
            adminName: row.adminName,
            adminGender: row.adminGender,
          })
        }
        tableFooter={footer}
      />
    </div>
  );
}
