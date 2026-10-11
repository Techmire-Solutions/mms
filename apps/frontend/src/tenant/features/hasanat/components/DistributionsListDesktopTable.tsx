import React from "react";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import { DistributionsRowActions } from "@/tenant/features/hasanat/components/DistributionsRowActions";
import { WorkBatchTable } from "@/components/common/work";
import { useDistributionsTableColumns } from "@/tenant/features/hasanat/hooks/useDistributionsTableColumns";
import {
  getDistributionStatuses,
  type DistributionsListContentProps,
} from "@/tenant/features/hasanat/components/distributionsListShared";

type DistributionsListDesktopTableProps = DistributionsListContentProps;

export function DistributionsListDesktopTable(
  props: DistributionsListDesktopTableProps,
): React.JSX.Element {
  const {
    distributions,
    denoms,
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    isColumnVisible,
    statusLabels,
    statusConfig,
    canWrite,
    canDelete,
    showDeleted,
    canRestoreRows,
    canDeleteRows,
    onMessage,
    onChangeStatus,
    onToggleSelectedDistribution,
    onToggleSelectAll,
    onTrashAction,
    getColumnWidth,
    onColumnResize,
    onRowClick,
  } = props;
  const { t } = useTranslation();
  const statuses = React.useMemo(() => getDistributionStatuses(statusConfig), [statusConfig]);
  const selectedIdsSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const columns = useDistributionsTableColumns({
    denoms,
    isColumnVisible,
    statusConfig,
    t,
  });

  return (
    <WorkBatchTable
      data={distributions}
      columns={columns}
      caption={t("hasanat.distribution.aria")}
      className="table-fixed"
      tableBodyClassName="divide-y divide-border/50"
      onRowClick={onRowClick ? (d) => onRowClick(d.id) : undefined}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) =>
                onToggleSelectedDistribution(String(id), !selectedIdsSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("hasanat.trash.selectAll"),
              selectRowAriaLabel: (distribution) =>
                t("hasanat.trash.selectDistribution", {
                  name: distribution.recipientName || distribution.id,
                }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth: (key) => getColumnWidth?.(key),
        onColumnResize,
      }}
      renderRowActions={(distribution) => (
        <DistributionsRowActions
          distribution={distribution}
          statuses={statuses}
          statusLabels={statusLabels}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          canRestoreRows={canRestoreRows}
          canDeleteRows={canDeleteRows}
          triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
          onMessage={onMessage ? (channel, dist) => onMessage(channel, [dist]) : undefined}
          onChangeStatus={onChangeStatus}
          onTrashAction={onTrashAction}
        />
      )}
      actionsLabel={t("hasanat.columns.actions")}
    />
  );
}
