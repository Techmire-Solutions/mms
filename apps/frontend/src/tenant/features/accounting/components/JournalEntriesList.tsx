import type React from "react";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { ListPagination } from "@/components/app/ListPagination";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { JournalEntriesListCards } from "@/tenant/features/accounting/components/JournalEntriesListCards";
import { JournalEntriesListDesktopTable } from "@/tenant/features/accounting/components/JournalEntriesListDesktopTable";
import type { JournalEntriesListPaging } from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";
import type { JournalEntriesListProps } from "@/tenant/features/accounting/lib/journalEntriesListShared";

/**
 * The shared list frame keeps the cards/table split and adds the pager once, so
 * both variants (mobile cards and desktop table) page the same way.
 */
export type JournalEntriesListWithPagingProps = JournalEntriesListProps & JournalEntriesListPaging;

export function JournalEntriesList(props: JournalEntriesListWithPagingProps): React.JSX.Element {
  const { t } = useTranslation();
  const { entries, page, limit, total, hasMore, onPageChange } = props;

  return (
    <>
      {entries.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={Receipt}
          title={
            props.showDeleted
              ? t("accounting.trash.empty")
              : props.hasActiveFilters
                ? t("accounting.journal.dashboard.noEntriesMatch")
                : t("accounting.journal.dashboard.noTransactionsYet")
          }
          description={
            props.showDeleted
              ? t("accounting.trash.emptyHint")
              : props.hasActiveFilters
                ? t("accounting.journal.dashboard.noEntriesHint")
                : t("accounting.journal.dashboard.useQuickActions")
          }
          action={
            props.showDeleted && props.onShowActive ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={props.onShowActive}
              >
                {t("accounting.trash.showActive")}
              </Button>
            ) : props.hasActiveFilters && props.onClearFilters ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={props.onClearFilters}
              >
                {t("common.clearFilters")}
              </Button>
            ) : props.canWrite && props.onCreate ? (
              <Button type="button" className="min-h-11" onClick={props.onCreate}>
                {t("accounting.journal.dashboard.newEntry")}
              </Button>
            ) : undefined
          }
        />
      ) : props.viewMode === "cards" ? (
        <JournalEntriesListCards {...props} />
      ) : (
        <JournalEntriesListDesktopTable {...props} />
      )}

      {/*
        Rendered for any non-empty result, not only when more pages exist: the
        "1–100 of 3,412" line is the only place the real size of the filtered
        journal is visible, and `total` is the server's count for the active
        filter rather than the length of the loaded page.
      */}
      {total > 0 && (
        <ListPagination
          page={page}
          total={total}
          limit={limit}
          hasMore={hasMore}
          onPageChange={onPageChange}
          i18nNamespace="accounting"
          variant="range"
        />
      )}
    </>
  );
}
