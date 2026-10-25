import React from "react";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import {
  getJournalBalanceDifference,
  isJournalBalanced,
} from "@/tenant/features/accounting/lib/journalEntriesListShared";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { JournalEntryCard, type JournalEntriesListCardsProps } from "./JournalEntryCard";

export type { JournalEntriesListCardsProps };

/** Accounting journal entries cards — shared directory chrome with a ledger summary strip. */
export function JournalEntriesListCards(props: JournalEntriesListCardsProps): React.JSX.Element {
  const {
    entries,
    selectedIds,
    canDelete,
    allVisibleSelected,
    someVisibleSelected,
    isColumnVisible,
    grandDebit,
    grandCredit,
    formatAmount,
    onToggleSelectAll,
  } = props;
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const balanced = isJournalBalanced(grandDebit, grandCredit);
  const pageCountLabel = formatDirectoryPageCountLabel(entries.length, t, {
    singular: "accounting.item.entry",
    plural: "accounting.item.entries",
  });

  return (
    <div className="space-y-4">
      <ModuleDirectoryCards
        items={entries}
        selectedIds={selectedIds}
        onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
        allSelected={allVisibleSelected}
        someSelected={someVisibleSelected}
        selectAllLabel={t("accounting.trash.selectAll")}
        deselectAllLabel={t("common.deselect")}
        selectedCountLabel={t("accounting.trash.selected", { count: selectedIds.length })}
        pageCountLabel={pageCountLabel}
        checkboxIdPrefix="accounting-select-cards"
        renderItem={(entry) => (
          <JournalEntryCard
            key={entry.id}
            entry={entry}
            props={props}
            reducedMotion={reducedMotion}
          />
        )}
      />
      <div
        className={cn(
          WORK_SURFACE,
          "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <p className="text-xs font-bold text-muted-foreground uppercase m-0">{pageCountLabel}</p>
        <StatGrid>
          {isColumnVisible("debit") && (
            <StatRow
              label={t("accounting.columns.journal.debit")}
              value={formatAmount(grandDebit)}
              ddClassName="font-mono font-bold text-info text-xs"
            />
          )}
          {isColumnVisible("credit") && (
            <StatRow
              label={t("accounting.columns.journal.credit")}
              value={formatAmount(grandCredit)}
              ddClassName="font-mono font-bold text-success text-xs"
            />
          )}
        </StatGrid>
        <p className="text-xs font-semibold text-muted-foreground m-0">
          {balanced ? (
            <span className="text-success">{t("accounting.journal.dashboard.balanced")}</span>
          ) : (
            <span className="text-destructive">
              {t("accounting.journal.dashboard.difference", {
                diff: getJournalBalanceDifference(grandDebit, grandCredit, formatAmount),
              })}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
