import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { WorkBatchTable, type WorkBatchTableFooterRow } from "@/components/common/work";
import {
  getJournalBalanceDifference,
  getVisibleLeadingColumnCount,
  isJournalBalanced,
  type JournalEntriesListProps,
} from "@/tenant/features/accounting/components/journalEntriesListShared";
import { useJournalEntriesTableColumns } from "./useJournalEntriesTableColumns";

type JournalEntriesListDesktopTableProps = JournalEntriesListProps;

export function JournalEntriesListDesktopTable(
  props: JournalEntriesListDesktopTableProps,
): React.JSX.Element {
  const {
    entries,
    selectedIds,
    canDelete,
    allVisibleSelected,
    someVisibleSelected,
    isColumnVisible,
    journalStatusConfig,
    grandDebit,
    grandCredit,
    formatAmount,
    renderEntryActions,
    onToggleSelectedEntry,
    onToggleSelectAll,
    getColumnWidth,
    onColumnResize,
  } = props;
  const { t } = useTranslation();
  const visibleLeadingColumnCount = getVisibleLeadingColumnCount(isColumnVisible);
  const entriesCountLabel = formatDirectoryPageCountLabel(entries.length, t, {
    singular: "accounting.item.entry",
    plural: "accounting.item.entries",
  });
  const balanced = isJournalBalanced(grandDebit, grandCredit);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const columns = useJournalEntriesTableColumns({
    isColumnVisible,
    journalStatusConfig,
    formatAmount,
  });

  const footerRow: WorkBatchTableFooterRow = {
    className: "border-t-2 border-border bg-muted/30",
    cells: [
      {
        colSpan: visibleLeadingColumnCount || 1,
        className: "table-footer-label",
        content: entriesCountLabel,
      },
      ...(isColumnVisible("debit")
        ? [
            {
              className: "table-amount-cell text-info text-xs",
              align: "end" as const,
              content: formatAmount(grandDebit),
            },
          ]
        : []),
      ...(isColumnVisible("credit")
        ? [
            {
              className: "table-amount-cell text-success text-xs",
              align: "end" as const,
              content: formatAmount(grandCredit),
            },
          ]
        : []),
      {
        colSpan: (isColumnVisible("status") ? 1 : 0) + 1,
        align: "end" as const,
        className: "px-3 py-2 text-end text-xs font-semibold text-muted-foreground",
        content: balanced ? (
          <span className="text-success">{t("accounting.journal.dashboard.balanced")}</span>
        ) : (
          <span className="text-destructive">
            {t("accounting.journal.dashboard.difference", {
              diff: getJournalBalanceDifference(grandDebit, grandCredit, formatAmount),
            })}
          </span>
        ),
      },
    ],
  };

  return (
    <WorkBatchTable
      data={entries}
      columns={columns}
      caption={t("accounting.journal.dashboard.tableCaption")}
      className="table-fixed"
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelectedEntry(String(id), !selectedSet.has(String(id))),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("accounting.trash.selectAll"),
              selectRowAriaLabel: (entry) => t("accounting.trash.selectEntry", { ref: entry.ref }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth: (key) => getColumnWidth?.(key),
        onColumnResize,
      }}
      renderRowActions={renderEntryActions}
      actionsLabel={renderEntryActions !== undefined ? t("accounting.table.actions") : undefined}
      footerRow={footerRow}
    />
  );
}
