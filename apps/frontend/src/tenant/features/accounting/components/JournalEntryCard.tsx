import React from "react";
import { formatDate } from "@mms/shared";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getJournalEntryLineTotals,
  getJournalTagLabel,
  type JournalEntriesListProps,
} from "@/tenant/features/accounting/lib/journalEntriesListShared";

export type JournalEntriesListCardsProps = Omit<
  JournalEntriesListProps,
  "getColumnWidth" | "onColumnResize" | "renderEntryActions" | "viewMode"
>;

export interface JournalEntryCardProps {
  entry: JournalEntriesListProps["entries"][number];
  props: JournalEntriesListCardsProps;
  reducedMotion: boolean;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function JournalEntryCard({
  entry,
  props,
  reducedMotion,
}: JournalEntryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    selectedIds,
    canDelete,
    isColumnVisible,
    journalStatusConfig,
    formatAmount,
    renderEntryActionsCards,
    onToggleSelectedEntry,
    onView,
  } = props;

  const { totalDebit, totalCredit } = getJournalEntryLineTotals(entry);

  return (
    <DirectoryEntityCard
      entity={entry}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedEntry}
      onView={onView}
      reducedMotion={reducedMotion}
      accentClassName={
        entry.reversed_ref
          ? "bg-warning/60 group-hover:bg-warning"
          : "bg-primary/50 group-hover:bg-primary"
      }
      header={{
        displayName: entry.description,
        subtitle: (
          <div className="min-w-0">
            <p className="mt-0.5 truncate font-mono text-xs font-bold text-primary">{entry.ref}</p>
            {entry.reversed_ref ? (
              <p className="text-xs text-warning font-semibold">
                {t("accounting.journal.dashboard.reversalOf", { ref: entry.reversed_ref })}
              </p>
            ) : null}
            {entry.simple_mode ? (
              <span className="text-xs text-primary/60 font-semibold">
                {t("accounting.journal.dashboard.simpleMode")}
              </span>
            ) : null}
          </div>
        ),
      }}
      viewAriaLabel={t("accounting.journal.actions.viewEntry", { ref: entry.ref })}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("date") && (
            <DirectoryCardMetaTile label={t("accounting.columns.journal.date")}>
              <span className="font-mono">{formatDate(entry.date)}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("tags") && (entry.tags || []).length > 0 && (
            <DirectoryCardMetaTile label={t("accounting.columns.journal.tags")}>
              <span className="flex flex-wrap gap-1">
                {(entry.tags || []).map((tag) => (
                  <Badge key={tag} pill tone="primary" className="px-1.5 font-bold">
                    {getJournalTagLabel(tag, t)}
                  </Badge>
                ))}
              </span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("status") && (
            <DirectoryCardMetaTile label={t("accounting.columns.journal.status")}>
              <StatusBadge status={entry.status} config={journalStatusConfig} size="sm" />
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("debit") && (
            <DirectoryCardMetaTile label={t("accounting.columns.journal.debit")}>
              <span className="font-mono text-xs font-semibold text-info">
                {formatAmount(totalDebit)}
              </span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("credit") && (
            <DirectoryCardMetaTile label={t("accounting.columns.journal.credit")}>
              <span className="font-mono text-xs font-semibold text-success">
                {formatAmount(totalCredit)}
              </span>
            </DirectoryCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      overflowActions={renderEntryActionsCards(entry)}
    />
  );
}
