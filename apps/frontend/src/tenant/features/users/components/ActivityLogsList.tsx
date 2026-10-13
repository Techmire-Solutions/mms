import React from "react";
import { Activity } from "lucide-react";
import { formatDate, type ActivityLog } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { type TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportDataGridContainer } from "@/tenant/components/moduleReports";
import { ActivityActionBadge } from "@/tenant/features/users/components/UserBadges";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { EntityCard } from "@/components/app/EntityCard";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import {
  resolveVisibleColumns,
  toColumnResize,
  type DataTableColumnLayout,
} from "@/components/common/data-table";

/** EntityCard tile (report) — not DirectoryCard. */
export interface ActivityLogsListProps {
  paginated: ActivityLog[];
  filteredCount: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  userNameFor: (log: ActivityLog) => string;
  viewMode: WorkDirectoryViewMode;
  columnLayout?: DataTableColumnLayout;
}

function useActivityLogColumns(
  t: TranslationFunction,
  fmtTs: (ts: string) => string,
  userNameFor: (log: ActivityLog) => string,
): WorkBatchTableColumn<ActivityLog>[] {
  return React.useMemo<WorkBatchTableColumn<ActivityLog>[]>(
    () => [
      {
        id: "time",
        label: t("users.activityColTime"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (log) => fmtTs(log.ts),
      },
      {
        id: "user",
        label: t("users.activityColUser"),
        cellClassName: "px-3 py-2.5 text-xs font-semibold text-foreground",
        render: (log) => userNameFor(log),
      },
      {
        id: "action",
        label: t("users.activityColAction"),
        cellClassName: "px-3 py-2.5",
        render: (log) => <ActivityActionBadge action={log.action} />,
      },
      {
        id: "detail",
        label: t("users.activityColDetail"),
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (log) => log.detail,
      },
      {
        id: "ip",
        label: t("users.activityColIp"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 font-mono text-xs text-muted-foreground",
        render: (log) => log.ip,
      },
    ],
    [t, fmtTs, userNameFor],
  );
}

export function ActivityLogsList({
  paginated,
  filteredCount,
  page,
  pageSize = 15,
  onPageChange,
  userNameFor,
  viewMode,
  columnLayout,
}: ActivityLogsListProps): React.JSX.Element {
  const { t } = useTranslation();
  const globalSettings = useGlobalSettings();
  const fmtTs = React.useCallback(
    (ts: string): string => formatDate(ts, globalSettings.dateFormat, false),
    [globalSettings.dateFormat],
  );

  const columns = useActivityLogColumns(t, fmtTs, userNameFor);

  const exportColumns = React.useMemo(
    () => [
      { key: "time", header: t("users.activityColTime") },
      { key: "user", header: t("users.activityColUser") },
      { key: "action", header: t("users.activityColAction") },
      { key: "detail", header: t("users.activityColDetail") },
      { key: "ip", header: t("users.activityColIp") },
    ],
    [t],
  );

  const exportRows = React.useMemo(
    () =>
      paginated.map((log) => ({
        time: fmtTs(log.ts),
        user: userNameFor(log),
        action: log.action,
        detail: log.detail,
        ip: log.ip,
      })),
    [paginated, fmtTs, userNameFor],
  );

  if (paginated.length === 0) {
    return <EmptyState variant="dashed" title={t("users.activityEmpty")} icon={Activity} compact />;
  }

  return (
    <ReportDataGridContainer
      title={t("users.activity")}
      columns={exportColumns}
      rows={exportRows}
      moduleId="users"
      page={page}
      total={filteredCount}
      limit={pageSize}
      onPageChange={onPageChange}
      i18nNamespace="users"
      paginationVariant="range"
    >
      {viewMode === "cards" ? (
        <EntityCardsGrid className="p-3">
          {paginated.map((log) => (
            <EntityCard key={log.id} className="space-y-3 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{userNameFor(log)}</p>
                  <p className="text-xs text-muted-foreground">{fmtTs(log.ts)}</p>
                </div>
                <ActivityActionBadge action={log.action} />
              </div>
              <StatGrid columns="1">
                <StatRow
                  label={t("users.activityColDetail")}
                  value={log.detail}
                  ddClassName="text-xs text-muted-foreground"
                />
                <StatRow
                  label={t("users.activityColIp")}
                  value={log.ip}
                  ddClassName="font-mono text-xs text-muted-foreground"
                />
              </StatGrid>
            </EntityCard>
          ))}
        </EntityCardsGrid>
      ) : (
        <WorkBatchTable<ActivityLog>
          data={paginated}
          columns={
            columnLayout ? resolveVisibleColumns(columns, columnLayout.columnRegistry) : columns
          }
          columnResize={toColumnResize(columnLayout)}
          bordered={false}
        />
      )}
    </ReportDataGridContainer>
  );
}
