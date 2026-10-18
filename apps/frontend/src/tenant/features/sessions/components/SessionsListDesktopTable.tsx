import React from "react";
import { Button } from "@/components/ui/button";
import { type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionSortField } from "@/tenant/features/sessions/lib/sessionPageTypes";
import type { Session } from "@/lib/data/sessionsData";
import type { SessionsWorkColumnLayout } from "@/tenant/features/sessions/lib/sessionsWorkListViewsShared";
import { renderSessionWorkColumnValue } from "@/tenant/features/sessions/components/sessionWorkColumnCell";
import { SessionListRowActions } from "@/tenant/features/sessions/components/SessionListRowActions";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";

interface SessionsListDesktopTableProps {
  sessions: Session[];
  showDeleted: boolean;
  canDelete: boolean;
  canSelectSessions: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  sortField: SessionSortField;
  sortDir: "asc" | "desc";
  columnLayout: SessionsWorkColumnLayout;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  onOpenDetail: (session: Session) => void;
  onSort: (field: SessionSortField) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedSession: (id: string, checked: boolean) => void;
  onRequestDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

export function SessionsListDesktopTable({
  sessions,
  showDeleted,
  canDelete,
  canSelectSessions,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  isColumnVisible,
  sortField,
  sortDir,
  columnLayout,
  statusConfig,
  typeConfig,
  onOpenDetail,
  onSort,
  onToggleSelectAll,
  onToggleSelectedSession,
  onRequestDelete,
  onRestore,
}: SessionsListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const columnOptions = React.useMemo(
    () => ({ t, statusConfig, typeConfig }),
    [t, statusConfig, typeConfig],
  );

  const columns = React.useMemo<WorkBatchTableColumn<Session>[]>(() => {
    const cols: WorkBatchTableColumn<Session>[] = [];

    if (isColumnVisible("name")) {
      cols.push({
        id: "name",
        label: t("sessions.columns.name"),
        sortField: "name",
        render: (sessionItem) => (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenDetail(sessionItem)}
            className="min-h-11 h-auto max-w-full p-0 text-sm font-semibold text-foreground hover:text-primary transition-colors text-start justify-start hover:bg-transparent"
            title={sessionItem.name}
          >
            <span className="block truncate">{sessionItem.name}</span>
          </Button>
        ),
      });
    }

    if (isColumnVisible("type")) {
      cols.push({
        id: "type",
        label: t("sessions.columns.type"),
        sortField: "type",
        render: (sessionItem) => renderSessionWorkColumnValue(sessionItem, "type", columnOptions),
      });
    }

    if (isColumnVisible("startDate")) {
      cols.push({
        id: "startDate",
        label: t("sessions.columns.startDate"),
        cellClassName: "text-xs text-muted-foreground",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "startDate", columnOptions),
      });
    }

    if (isColumnVisible("endDate")) {
      cols.push({
        id: "endDate",
        label: t("sessions.columns.endDate"),
        cellClassName: "text-xs text-muted-foreground",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "endDate", columnOptions),
      });
    }

    if (isColumnVisible("duration")) {
      cols.push({
        id: "duration",
        label: t("sessions.columns.duration"),
        cellClassName: "text-xs text-muted-foreground",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "duration", columnOptions),
      });
    }

    if (isColumnVisible("fee")) {
      cols.push({
        id: "fee",
        label: t("sessions.columns.fee"),
        sortField: "baseFee",
        cellClassName: "text-xs font-medium",
        render: (sessionItem) => renderSessionWorkColumnValue(sessionItem, "fee", columnOptions),
      });
    }

    if (isColumnVisible("currency")) {
      cols.push({
        id: "currency",
        label: t("sessions.columns.currency"),
        cellClassName: "text-xs text-muted-foreground",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "currency", columnOptions),
      });
    }

    if (isColumnVisible("enrolled")) {
      cols.push({
        id: "enrolled",
        label: t("sessions.columns.enrolled"),
        cellClassName: "text-xs text-muted-foreground",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "enrolled", columnOptions),
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("sessions.columns.status"),
        sortField: "status",
        render: (sessionItem) => renderSessionWorkColumnValue(sessionItem, "status", columnOptions),
      });
    }

    if (isColumnVisible("description")) {
      cols.push({
        id: "description",
        label: t("sessions.columns.description"),
        cellClassName: "text-xs text-muted-foreground max-w-cell-sm truncate",
        render: (sessionItem) =>
          renderSessionWorkColumnValue(sessionItem, "description", columnOptions),
      });
    }

    return cols;
  }, [columnOptions, isColumnVisible, onOpenDetail, t]);

  return (
    <WorkBatchTable
      data={sessions}
      columns={columns}
      className="table-fixed"
      tableBodyClassName="divide-y divide-border/50"
      stickyColumnId="name"
      sort={{
        field: sortField,
        dir: sortDir,
        onSort: (field) => onSort(field as SessionSortField),
      }}
      columnResize={{
        getColumnWidth: columnLayout.getColumnWidth,
        onColumnResize: columnLayout.setColumnWidth,
      }}
      selection={
        canSelectSessions
          ? {
              selectedIds,
              onSelectOne: (id) =>
                onToggleSelectedSession(String(id), !selectedSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("sessions.table.selectAll"),
              selectRowAriaLabel: (sessionItem) => sessionItem.name,
            }
          : undefined
      }
      renderRowActions={
        canDelete
          ? (sessionItem) => (
              <SessionListRowActions
                session={sessionItem}
                showDeleted={showDeleted}
                canDelete={canDelete}
                onRequestDelete={onRequestDelete}
                onRestore={onRestore}
                triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
              />
            )
          : undefined
      }
      actionsLabel={canDelete ? t("common.actions") : undefined}
    />
  );
}
