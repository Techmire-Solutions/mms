import { useMemo } from "react";
import { formatDate } from "@mms/shared";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { type WorkBatchTableColumn } from "@/components/common/work";
import type { JournalEntry } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getJournalEntryLineTotals,
  getJournalTagLabel,
  type JournalEntriesListProps,
} from "../lib/journalEntriesListShared";

interface UseJournalEntriesTableColumnsParams {
  isColumnVisible: JournalEntriesListProps["isColumnVisible"];
  journalStatusConfig: JournalEntriesListProps["journalStatusConfig"];
  formatAmount: JournalEntriesListProps["formatAmount"];
}

export function useJournalEntriesTableColumns({
  isColumnVisible,
  journalStatusConfig,
  formatAmount,
}: UseJournalEntriesTableColumnsParams): WorkBatchTableColumn<JournalEntry>[] {
  const { t } = useTranslation();
  return useMemo<WorkBatchTableColumn<JournalEntry>[]>(() => {
    const cols: WorkBatchTableColumn<JournalEntry>[] = [];

    if (isColumnVisible("ref")) {
      cols.push({
        id: "ref",
        label: t("accounting.columns.journal.ref"),
        noWrap: true,
        render: (entry) => (
          <>
            <span className="font-mono text-xs font-bold text-primary">{entry.ref}</span>
            {entry.reversed_ref && (
              <p className="text-xs text-warning font-semibold m-0">
                {t("accounting.journal.dashboard.reversalOf", { ref: entry.reversed_ref })}
              </p>
            )}
            {entry.simple_mode && (
              <span className="text-xs text-primary/60 font-semibold m-0">
                {t("accounting.journal.dashboard.simpleMode")}
              </span>
            )}
          </>
        ),
      });
    }

    if (isColumnVisible("date")) {
      cols.push({
        id: "date",
        label: t("accounting.columns.journal.date"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (entry) => formatDate(entry.date),
      });
    }

    if (isColumnVisible("description")) {
      cols.push({
        id: "description",
        label: t("accounting.columns.journal.description"),
        truncate: true,
        cellClassName: "max-w-cell-trunc",
        render: (entry) => entry.description,
      });
    }

    if (isColumnVisible("tags")) {
      cols.push({
        id: "tags",
        label: t("accounting.columns.journal.tags"),
        headerClassName: "hidden lg:table-cell",
        cellClassName: "hidden lg:table-cell",
        render: (entry) => (
          <div className="flex flex-wrap gap-1">
            {(entry.tags || []).slice(0, 2).map((tag) => (
              <Badge key={tag} pill tone="primary" className="px-1.5 font-bold">
                {getJournalTagLabel(tag, t)}
              </Badge>
            ))}
            {(entry.tags || []).length > 2 && (
              <span className="text-xs text-muted-foreground">+{entry.tags.length - 2}</span>
            )}
          </div>
        ),
      });
    }

    if (isColumnVisible("debit")) {
      cols.push({
        id: "debit",
        label: t("accounting.columns.journal.debit"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "text-end font-mono text-xs font-semibold text-info",
        render: (entry) => {
          const { totalDebit } = getJournalEntryLineTotals(entry);
          return formatAmount(totalDebit);
        },
      });
    }

    if (isColumnVisible("credit")) {
      cols.push({
        id: "credit",
        label: t("accounting.columns.journal.credit"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "text-end font-mono text-xs font-semibold text-success",
        render: (entry) => {
          const { totalCredit } = getJournalEntryLineTotals(entry);
          return formatAmount(totalCredit);
        },
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("accounting.columns.journal.status"),
        noWrap: true,
        render: (entry) => (
          <StatusBadge status={entry.status} config={journalStatusConfig} size="sm" />
        ),
      });
    }

    return cols;
  }, [formatAmount, isColumnVisible, journalStatusConfig, t]);
}
