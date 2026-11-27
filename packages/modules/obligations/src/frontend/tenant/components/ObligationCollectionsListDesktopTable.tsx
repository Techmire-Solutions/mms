import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@mms/ui";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@mms/ui/app/ModuleRowActionsMenu";
import { useTranslation } from "@mms/fe-core/i18n";
import { ObligationCollectionRowActions } from "./ObligationCollectionRowActions";
import { WorkBatchTable } from "@mms/fe-core/components/WorkBatchTable";
import { useMergedObligationUsers } from "../hooks/useObligationLookups";
import type { ObligationCollectionListContentProps } from "../lib/obligationCollectionListContentShared";
import { useObligationCollectionTableColumns } from "../hooks/useObligationCollectionTableColumns";

type ObligationCollectionsListDesktopTableProps = Omit<
  ObligationCollectionListContentProps,
  "search" | "typeFilter" | "onAddNew" | "viewMode"
> & {
  viewMode?: ObligationCollectionListContentProps["viewMode"];
};

export function ObligationCollectionsListDesktopTable(
  props: ObligationCollectionsListDesktopTableProps,
): React.JSX.Element {
  const {
    collections,
    selectedIds,
    isColumnVisible,
    allVisibleSelected,
    someVisibleSelected,
    canWrite,
    canDelete,
    showDeleted,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    getColumnWidth,
    onColumnResize,
    onView,
    onPrint,
    onToggleSelectAll,
    onToggleSelectedCollection,
    onTrashAction,
    onMessage,
    onViewVoucher,
  } = props;
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const receiverIds = React.useMemo(
    () => collections.map((c: any) => c.received_by).filter(Boolean),
    [collections],
  );
  const users = useMergedObligationUsers(receiverIds);
  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(String(u.id), u.name || u.loginEmail || String(u.id));
    }
    return map;
  }, [users]);

  const columns = useObligationCollectionTableColumns({
    isColumnVisible,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    userMap,
    onViewVoucher,
    t,
  });

  return (
    <WorkBatchTable
      data={collections}
      columns={columns}
      caption={t("obligations.collectionsList")}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id: any) =>
                onToggleSelectedCollection(String(id), !selectedSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("obligations.trash.selectAll"),
              selectRowAriaLabel: (c: any) =>
                t("obligations.trash.selectCollection", { receipt: c.receipt_no }),
            }
          : undefined
      }
      columnResize={{ getColumnWidth: (key: any) => getColumnWidth?.(key), onColumnResize }}
      renderRowActions={(collection: any) => (
        <div className="flex items-center gap-1 justify-end">
          {!showDeleted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 touch-target-coarse"
              onClick={() => onPrint(collection)}
              aria-label={t("obligations.actions.printShort")}
              title={t("obligations.actions.printShort")}
            >
              <Printer className="w-4 h-4" />
            </Button>
          )}
          <ObligationCollectionRowActions
            collection={collection}
            canWrite={canWrite}
            canDelete={canDelete}
            showDeleted={showDeleted}
            onView={onView}
            onPrint={onPrint}
            onMessage={onMessage}
            onViewVoucher={onViewVoucher}
            onTrashAction={onTrashAction}
            triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
          />
        </div>
      )}
    />
  );
}
